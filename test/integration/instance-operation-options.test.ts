import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { Gtfs, type GtfsReportEvent } from '../../src/index.ts';
import { resolveGtfsInstanceConfig } from '../../src/config/resolver.ts';
import {
  resolveInstanceImportOptions,
  resolveInstanceRefreshOptions,
  resolveInstanceExportOptions,
} from '../../src/config/operation-options.ts';

const feed = 'test/fixtures/caltrain_20160406.zip';
test('operation precedence preserves defaults and snapshots complete replacement inputs', () => {
  const defaultReporter = () => {};
  const defaults = resolveGtfsInstanceConfig({
    database: {},
    sources: [
      {
        sourceId: 'north',
        schedule: {
          url: 'https://example.test/old.zip',
          requestHeaders: { authorization: 'old' },
          import: {
            validation: { mode: 'strict', onUnknownField: 'preserve' },
          },
        },
        realtime: {
          feeds: [{ type: 'alerts', url: 'https://example.test/old.pb' }],
        },
      },
    ],
    reporting: { reporter: defaultReporter, level: 'warn' },
    realtime: {
      retention: { currentEntitiesSeconds: 99, snapshotsSeconds: 500 },
    },
    export: { sourceId: 'north', batchSize: 7 },
  });
  const resolved = resolveInstanceImportOptions(
    defaults,
    ['north'],
    [{ validation: { mode: 'off' }, reporting: { reporter: () => {} } }],
  );
  assert.deepEqual(resolved.sources[0]?.schedule.import.validation, {
    mode: 'off',
    onUnknownField: 'preserve',
    onDuplicateKey: 'reject',
  });
  assert.equal(resolved.reporting.level, 'info');
  assert.equal(defaults.reporting.level, 'warn');
  assert.equal(defaults.sources[0]?.schedule?.import.validation.mode, 'strict');
  assert.strictEqual(
    resolveInstanceImportOptions(defaults, ['north'], []).reporting,
    defaults.reporting,
  );
  const inputs = [
    {
      sourceId: 'north',
      schedule: {
        url: 'https://example.test/new.zip',
        requestHeaders: { authorization: 'new' },
      },
    },
  ];
  const replaced = resolveInstanceImportOptions(
    defaults,
    ['north'],
    [{ sources: inputs }],
  );
  inputs[0]!.schedule.requestHeaders.authorization = 'changed';
  inputs[0]!.sourceId = 'south';
  const schedule = replaced.sources[0]!.schedule;
  assert.equal(replaced.sources[0]?.sourceId, 'north');
  assert.ok('url' in schedule);
  assert.equal(schedule.requestHeaders.authorization, 'new');
  assert.equal(schedule.import.validation.mode, 'off');
  const local = resolveInstanceImportOptions(
    defaults,
    ['north'],
    [{ sources: [{ sourceId: 'north', schedule: { path: feed } }] }],
  );
  assert.equal('requestHeaders' in local.sources[0]!.schedule, false);
  assert.deepEqual(
    resolveInstanceRefreshOptions(
      defaults,
      ['north'],
      [{ retention: { snapshotsSeconds: null } }],
    ).realtime.retention,
    { currentEntitiesSeconds: 99, snapshotsSeconds: null },
  );
  assert.equal(
    resolveInstanceExportOptions(defaults, ['north'], [{ overwrite: true }])
      .export.batchSize,
    7,
  );
  assert.equal(
    resolveInstanceExportOptions(defaults, ['north'], [{ reporting: {} }])
      .reporting.reporter,
    undefined,
  );
});

test('invalid options and out-of-scope writes/exports reject before SQL, fetch, reporting or output', async (t) => {
  const statements: string[] = [];
  const sqlite = new Database(':memory:', {
    verbose: (statement) => statements.push(String(statement)),
  });
  const events: GtfsReportEvent[] = [];
  const gtfs = new Gtfs({
    database: { client: sqlite },
    extensions: ['gtfs-realtime'],
    sources: [{ sourceId: 'north' }, { sourceId: 'east' }],
    reporting: { reporter: (event) => events.push(event) },
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('Unexpected fetch');
  });
  const count = statements.length;
  try {
    for (const action of [
      () =>
        gtfs.import({
          sources: [{ sourceId: 'south', schedule: { path: feed } }],
        }),
      () => gtfs.import({ sources: [{ schedule: { path: feed } }] } as never),
      () =>
        gtfs.import({
          sources: [
            {
              sourceId: 'north',
              schedule: { path: feed, url: 'https://example.test/a' },
            },
          ],
        } as never),
      () =>
        gtfs.import({
          sources: [{ sourceId: 'north', schedule: { path: feed } }],
          validation: { mode: 'invalid' },
        } as never),
      () =>
        gtfs.realtime.refresh({
          sources: [
            {
              sourceId: 'south',
              realtime: {
                feeds: [{ type: 'alerts', url: 'https://example.test/a' }],
              },
            },
          ],
        }),
      () =>
        gtfs.realtime.refresh({
          sources: [],
          retention: { snapshotsSeconds: -1 },
        }),
      () => gtfs.export({ sourceId: 'south' }),
      () => gtfs.export(),
      () => gtfs.export({ sourceId: undefined } as never),
      () => gtfs.import({ database: {} } as never),
      () => gtfs.import({ signal: {} } as never),
      () => gtfs.realtime.refresh({ extensions: ['gtfs-realtime'] } as never),
    ]) {
      await assert.rejects(action, { code: 'GTFS_CONFIG_INVALID' });
      assert.equal(statements.length, count);
      assert.equal(events.length, 0);
      assert.equal(fetch.mock.callCount(), 0);
    }
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter}: one scoped instance imports different inputs and exports a selected source without retaining overrides`, async () => {
    const sqlite = new Database(':memory:');
    const client = new Kysely<GtfsDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-operation-'));
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: { client: adapter === 'native' ? sqlite : client },
      sources: [{ sourceId: 'north' }, { sourceId: 'south' }],
    });
    try {
      for (const [sourceId, agency] of [
        ['north', 'First'],
        ['south', 'Second'],
        ['north', 'Updated'],
      ] as const) {
        await writeFile(
          path.join(directory, 'agency.txt'),
          `agency_id,agency_name,agency_url,agency_timezone\nA,${agency},https://example.test,America/Los_Angeles\n`,
        );
        const result = await gtfs.import({
          sources: [{ sourceId, schedule: { path: directory } }],
          reporting: { reporter: (event) => events.push(event) },
        });
        assert.equal(result.success, true);
      }
      assert.deepEqual(
        await gtfs.schedule.agency
          .select('source_id', 'agency_name')
          .orderBy([{ field: 'source_id' }])
          .all(),
        [
          { source_id: 'north', agency_name: 'Updated' },
          { source_id: 'south', agency_name: 'Second' },
        ],
      );
      const exported = await gtfs.export({
        sourceId: 'south',
        outputDirectory: path.join(directory, 'exported'),
        reporting: { level: 'silent' },
      });
      assert.equal(exported.sourceId, 'south');
      assert.ok(events.some((event) => event.type === 'operation:complete'));
      assert.equal(gtfs.reporting.reporter, undefined);
      await assert.rejects(() => gtfs.import(), {
        code: 'GTFS_CONFIG_INVALID',
      });
      await assert.rejects(() => gtfs.export(), {
        code: 'GTFS_CONFIG_INVALID',
      });
      await assert.rejects(
        () =>
          gtfs.import({
            sources: [{ sourceId: 'north', schedule: { path: directory } }],
            validation: { mode: 'strict' },
          }),
        { code: 'GTFS_VALIDATION_FAILED' },
      );
      assert.equal(
        await gtfs.schedule.agency
          .where({ source_id: 'north' })
          .select('agency_name')
          .firstOrThrow()
          .then((row) => row.agency_name),
        'Updated',
      );
    } finally {
      await gtfs.close();
      await client.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('per-call Realtime endpoints, retention and reporting do not change instance defaults', async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(String(url));
    const payload = GtfsRealtimeBindings.transit_realtime.FeedMessage.encode({
      header: { gtfsRealtimeVersion: '2.0', timestamp: urls.length },
      entity: [
        {
          id: 'alert',
          alert: {
            headerText: { translation: [{ text: 'Hello' }] },
            descriptionText: { translation: [{ text: 'Details' }] },
          },
        },
      ],
    }).finish();
    return new Response(payload);
  });
  const gtfs = new Gtfs({
    database: {},
    extensions: ['gtfs-realtime'],
    sources: [
      {
        sourceId: 'north',
        realtime: {
          feeds: [{ type: 'alerts', url: 'https://example.test/default.pb' }],
        },
      },
    ],
  });
  try {
    assert.equal(
      (
        await gtfs.realtime.refresh({
          sources: [
            {
              sourceId: 'north',
              realtime: {
                feeds: [
                  { type: 'alerts', url: 'https://example.test/override.pb' },
                ],
              },
            },
          ],
          retention: { currentEntitiesSeconds: 123 },
          reporting: { level: 'silent' },
        })
      ).success,
      true,
    );
    const alert = await gtfs.realtime.alerts.firstOrThrow();
    assert.equal(
      Number(alert.expires_at_unix_seconds) -
        Number(alert.created_at_unix_seconds),
      123,
    );
    assert.equal((await gtfs.realtime.refresh()).success, true);
    assert.deepEqual(urls, [
      'https://example.test/override.pb',
      'https://example.test/default.pb',
    ]);
    const restored = await gtfs.realtime.alerts.firstOrThrow();
    assert.equal(
      Number(restored.expires_at_unix_seconds) -
        Number(restored.created_at_unix_seconds),
      30,
    );
  } finally {
    await gtfs.close();
  }
});

test('queued imports snapshot their options before execution and unscoped instances accept explicit identities', async () => {
  const gtfs = new Gtfs({ database: {} });
  let release = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const preceding = gtfs.database.withKysely({ callback: () => barrier });
    const options = {
      sources: [{ sourceId: 'selected', schedule: { path: feed } }],
    };
    const importing = gtfs.import(options);
    options.sources[0]!.sourceId = 'changed';
    options.sources[0]!.schedule.path = 'missing-file.zip';
    release();
    await preceding;
    assert.equal((await importing).success, true);
    assert.deepEqual(await gtfs.schedule.agency.select('source_id').all(), [
      { source_id: 'selected' },
    ]);
    assert.equal(gtfs.sourceIds, null);
  } finally {
    release();
    await gtfs.close();
  }
});
