import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { verifySourceRevisionCoordination } from '../helpers/source-revision.ts';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';
import { createDeferred } from '../helpers/deferred.ts';

for (const adapter of ['native', 'kysely'] as const) {
  for (const shared of [true, false]) {
    test(
      `Schedule/Realtime revision guard: ${adapter}, ${shared ? 'shared' : 'separate'} connections`,
      { timeout: 20_000 },
      async () => {
        const directory = await mkdtemp(
          path.join(tmpdir(), 'gtfs-revision-db-'),
        );
        const filename = path.join(directory, 'gtfs.sqlite');
        const first = new Database(filename);
        first.pragma('journal_mode = WAL');
        const second = shared ? first : new Database(filename);
        const scheduleClient =
          adapter === 'native'
            ? first
            : new Kysely({ dialect: new SqliteDialect({ database: first }) });
        const realtimeClient = shared
          ? scheduleClient
          : adapter === 'native'
            ? second
            : new Kysely({ dialect: new SqliteDialect({ database: second }) });
        try {
          await verifySourceRevisionCoordination({
            scheduleDatabase: { client: scheduleClient },
            realtimeDatabase: { client: realtimeClient },
          });
        } finally {
          for (const client of new Set([scheduleClient, realtimeClient])) {
            if (client instanceof Kysely) {
              await client.destroy();
            } else {
              client.close();
            }
          }
          await rm(directory, { recursive: true, force: true });
        }
      },
    );
  }
}

test(
  'a Schedule import in another process invalidates an in-flight refresh',
  { timeout: 20_000 },
  async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-revision-process-'),
    );
    const filename = path.join(directory, 'gtfs.sqlite');
    const gtfs = new Gtfs({
      database: { path: filename },
      extensions: ['gtfs-realtime'],
      sources: [
        {
          sourceId: 'source',
          schedule: { path: 'test/fixtures/complete' },
          realtime: {
            feeds: [{ type: 'alerts', url: 'https://example.test/feed.pb' }],
          },
        },
      ],
      reporting: { level: 'silent' },
    });
    const entered = createDeferred();
    const release = createDeferred();
    t.mock.method(globalThis, 'fetch', async () => {
      entered.resolve();
      await release.promise;
      return new Response(
        encodeRealtimeFeed({
          incrementality: 'FULL_DATASET',
          timestamp: 1,
          entities: [],
        }),
      );
    });
    try {
      await gtfs.import();
      const result = gtfs.realtime.refresh().then(
        () => undefined,
        (error: unknown) => error,
      );
      await entered.promise;
      await promisify(execFile)(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
      import { importGtfs } from './src/index.ts';
      await importGtfs({
        database: { path: process.argv[1] },
        sources: [{ sourceId: 'source', schedule: { path: 'test/fixtures/complete' } }],
        reporting: { level: 'silent' },
      });
    `,
          filename,
        ],
        { timeout: 15_000 },
      );
      release.resolve();
      const error = await result;
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.REALTIME_SCHEDULE_CHANGED);
      assert.deepEqual(await gtfs.realtime.persistence.snapshots.all(), []);
      await gtfs.realtime.refresh();
      assert.equal((await gtfs.realtime.persistence.snapshots.all()).length, 1);
    } finally {
      release.resolve();
      await gtfs.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
