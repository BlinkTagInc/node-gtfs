import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import {
  Gtfs,
  GtfsErrorCode,
  importGtfs,
  refreshGtfsRealtime,
  isGtfsError,
  type GtfsDatabaseConfig,
  type GtfsImportOptions,
} from '../../src/index.ts';
import { encodeRealtimeFeed } from './realtime-feed.ts';
import { realtimeTableNames } from '../../src/database/source-state.ts';
import { createDeferred } from './deferred.ts';

export async function verifySourceRevisionCoordination(options: {
  scheduleDatabase: GtfsImportOptions['database'];
  realtimeDatabase: GtfsDatabaseConfig;
}): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-source-revision-'));
  const sourceId = 'schedule-refresh';
  const otherId = 'other-source';
  const scheduleSource = (id: string) => ({
    sourceId: id,
    schedule: { path: directory },
  });
  const realtimeSource = (id: string) => ({
    sourceId: id,
    realtime: {
      feeds: [
        { type: 'alerts' as const, url: `https://example.test/${id}.pb` },
      ],
    },
  });
  const schedule = new Gtfs({
    database: options.scheduleDatabase,
    sources: [scheduleSource(sourceId)],
    reporting: { level: 'silent' },
  });
  const realtime = new Gtfs({
    database: options.realtimeDatabase,
    extensions: ['gtfs-realtime'],
    sources: [realtimeSource(sourceId)],
    reporting: { level: 'silent' },
  });
  const originalFetch = globalThis.fetch;
  const payload = encodeRealtimeFeed({
    incrementality: 'FULL_DATASET',
    timestamp: 1,
    entities: [
      {
        id: 'shared-alert',
        alert: {
          headerText: { translation: [{ text: 'Alert' }] },
          descriptionText: { translation: [{ text: 'Description' }] },
          informedEntity: [{ routeId: 'route' }],
        },
      },
    ],
  });
  let download:
    | {
        entered: ReturnType<typeof createDeferred>;
        release: ReturnType<typeof createDeferred>;
      }
    | undefined;
  globalThis.fetch = (async () => {
    const current = download;
    current?.entered.resolve();
    await current?.release.promise;
    return new Response(payload);
  }) as typeof fetch;
  const pendingRefresh = () => {
    download = { entered: createDeferred(), release: createDeferred() };
    const result = realtime.realtime.refresh().then(
      () => undefined,
      (error: unknown) => error,
    );
    return { ...download, result };
  };
  const counts = (id: string) =>
    realtime.database.withKysely({
      callback: async (database) => {
        const result: Record<string, number> = {};
        for (const table of realtimeTableNames) {
          const count = await sql<{
            count: number | string;
          }>`select count(*) as count from ${sql.table(table)} where source_id = ${id}`.execute(
            database,
          );
          result[table] = Number(count.rows[0]?.count);
        }
        return result;
      },
    });
  try {
    await writeFile(
      path.join(directory, 'agency.txt'),
      'agency_id,agency_name,agency_url,agency_timezone\na,Transit,https://example.test,Etc/UTC\n',
    );
    const routesPath = path.join(directory, 'routes.txt');
    const routes = 'route_id,route_short_name,route_type\nroute,R,3\n';
    await writeFile(routesPath, routes);
    await realtime.schema.recreate();
    await schedule.import();
    await importGtfs({
      database: options.scheduleDatabase,
      sources: [scheduleSource(otherId)],
      reporting: { level: 'silent' },
    });
    await realtime.realtime.refresh();
    await refreshGtfsRealtime({
      database: options.realtimeDatabase,
      extensions: ['gtfs-realtime'],
      sources: [realtimeSource(otherId)],
      reporting: { level: 'silent' },
    });
    const oldRows = await counts(sourceId);
    const otherRows = await counts(otherId);
    assert.equal(oldRows.alerts, 1);
    assert.equal(oldRows.realtime_snapshots, 1);

    // The importer has no Realtime extension/endpoints, but must still clear
    // existing Realtime state and invalidate responses already in flight.
    const stale = pendingRefresh();
    await stale.entered.promise;
    await schedule.import();
    stale.release.resolve();
    const rejected = await stale.result;
    assert.ok(isGtfsError(rejected));
    assert.equal(rejected.code, GtfsErrorCode.REALTIME_SCHEDULE_CHANGED);
    assert.equal(rejected.details?.sourceId, sourceId);
    assert.ok(
      Object.values(await counts(sourceId)).every((count) => count === 0),
    );
    assert.deepEqual(await counts(otherId), otherRows);

    download = undefined;
    await realtime.realtime.refresh();
    assert.deepEqual(
      await counts(sourceId),
      oldRows,
      'Identical payload is reapplied after Schedule replacement',
    );

    const unrelated = pendingRefresh();
    await unrelated.entered.promise;
    await importGtfs({
      database: options.scheduleDatabase,
      sources: [scheduleSource(otherId)],
      reporting: { level: 'silent' },
    });
    unrelated.release.resolve();
    assert.equal(
      await unrelated.result,
      undefined,
      'Another source cannot invalidate this refresh',
    );
    assert.deepEqual(await counts(sourceId), oldRows);

    const retained = pendingRefresh();
    await retained.entered.promise;
    await writeFile(routesPath, `${routes}route,Duplicate,3\n`);
    await assert.rejects(schedule.import(), (error: unknown) =>
      isGtfsError(error),
    );
    retained.release.resolve();
    assert.equal(
      await retained.result,
      undefined,
      'Rollback restores the revision captured before replacement',
    );
    assert.deepEqual(
      await counts(sourceId),
      oldRows,
      'Rollback restores current state and history',
    );
    assert.deepEqual(
      await schedule.schedule.routes.select('route_short_name').all(),
      [{ route_short_name: 'R' }],
    );
  } finally {
    download?.release.resolve();
    globalThis.fetch = originalFetch;
    await Promise.all([schedule.close(), realtime.close()]);
    await rm(directory, { recursive: true, force: true });
  }
}
