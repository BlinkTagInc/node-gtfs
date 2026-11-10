import { configIssueDetails } from '../helpers/config-issues.ts';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import {
  DEFAULT_GTFS_EXTENSIONS,
  Gtfs,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  exportGtfs,
  importGtfs,
  isGtfsError,
  refreshGtfsRealtime,
  type GtfsExtensionSelection,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';
import { fixtureExtensions } from '../fixtures/extensions.ts';
import {
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
  inspectSqliteGtfsSchema,
} from '../../src/sqlite.ts';

function tableNames(client: Database.Database): string[] {
  return client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .pluck()
    .all() as string[];
}

describe('GTFS extension policy', () => {
  test('rejects auto outside Schedule import before database or feed access', async (t) => {
    const statements: unknown[] = [];
    const sqlite = new Database(':memory:', {
      verbose: (statement) => statements.push(statement),
    });
    const database = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      assert.fail('Invalid extension selection must not fetch feeds');
    });
    const config = {
      database: { client: database },
      extensions: 'auto',
      sources: [
        {
          schedule: { path: 'test/fixtures/complete' },
          realtime: {
            feeds: [{ type: 'alerts', url: 'https://example.test/alerts.pb' }],
          },
        },
      ],
    } as const;
    const operations: readonly [string, () => Promise<unknown>][] = [
      [
        'instance',
        async () => {
          const gtfs = new Gtfs(config as never);
          await gtfs.close();
        },
      ],
      ['export', () => exportGtfs(config as never)],
      ['Realtime refresh', () => refreshGtfsRealtime(config as never)],
    ];
    try {
      for (const [name, operation] of operations) {
        await t.test(name, async () => {
          await assert.rejects(operation, (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
            assert.equal(error.category, GtfsErrorCategory.CONFIG);
            assert.deepEqual(configIssueDetails(error.details?.errors ?? []), [
              {
                reason: 'invalid-combination',
                path: 'extensions',
              },
            ]);
            return true;
          });
          assert.equal(fetch.mock.callCount(), 0);
          assert.deepEqual(statements, []);
          assert.equal(sqlite.open, true);
        });
      }
    } finally {
      await database.destroy();
      if (sqlite.open) {
        sqlite.close();
      }
    }
  });

  test('import rejects invalid runtime configuration shapes with or without auto', async () => {
    for (const config of [
      undefined,
      null,
      false,
      'invalid',
      [],
      Object.assign([], { extensions: 'auto' }),
      Object.assign(new Date(), { extensions: 'auto' }),
    ]) {
      await assert.rejects(importGtfs(config as never), (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
        assert.equal(error.category, GtfsErrorCategory.CONFIG);
        return true;
      });
    }
  });

  for (const extensions of [
    [],
    ['gtfs-plus'],
    ['gtfs-plus', 'gtfs-ride'],
  ] as const satisfies readonly GtfsExtensionSelection[]) {
    test(`groups disabled files by extension and source with extensions=${JSON.stringify(extensions)}`, async () => {
      const fixture = await mkdtemp(
        path.join(tmpdir(), 'gtfs-grouped-extensions-'),
      );
      const sqlite = new Database(':memory:');
      const events: GtfsReportEvent[] = [];
      const plusFiles = [
        'calendar_attributes.txt',
        'directions.txt',
        'route_attributes.txt',
        'stop_attributes.txt',
      ] as const;
      const extensionFiles = [...plusFiles, 'ride_feed_info.txt'] as const;
      try {
        await cp('test/fixtures/complete', fixture, { recursive: true });
        for (const filename of extensionFiles) {
          const table = Object.values(gtfsManifest).find(
            (entry) => entry.filename === filename,
          );
          assert.ok(table);
          await writeFile(
            path.join(fixture, filename),
            `${Object.keys(table.fields).join(',')}\n`,
          );
        }
        const report = await importGtfs({
          database: { client: sqlite },
          sources: [
            { sourceId: 'first', schedule: { path: fixture } },
            {
              sourceId: 'second',
              schedule: {
                path: fixture,
                excludeFiles: ['route_attributes.txt'],
              },
            },
            {
              sourceId: 'excluded',
              schedule: { path: fixture, excludeFiles: extensionFiles },
            },
          ],
          extensions,
          reporting: { reporter: (event) => events.push(event) },
        });
        assert.equal(report.success, true);
        const expected =
          extensions.length === 2
            ? []
            : ['first', 'second'].flatMap((sourceId) => {
                const filenames = plusFiles.filter(
                  (filename) =>
                    sourceId === 'first' || filename !== 'route_attributes.txt',
                );
                return [
                  ...(extensions.length === 0
                    ? [
                        {
                          code: GtfsValidationNoticeCode.EXTENSION_DISABLED,
                          severity: 'warn',
                          sourceId,
                          filename: filenames[0],
                          message: `${filenames.join(', ')} are part of the "gtfs-plus" GTFS extension and were not imported; add "gtfs-plus" to the \`extensions\` array in configuration to import them`,
                          details: {
                            extension: 'gtfs-plus',
                            filenames,
                            tables: filenames.map((filename) =>
                              filename.replace('.txt', ''),
                            ),
                            enabledExtensions: extensions,
                          },
                        },
                      ]
                    : []),
                  {
                    code: GtfsValidationNoticeCode.EXTENSION_DISABLED,
                    severity: 'warn',
                    sourceId,
                    filename: 'ride_feed_info.txt',
                    message:
                      'ride_feed_info.txt is part of the "gtfs-ride" GTFS extension and was not imported; add "gtfs-ride" to the `extensions` array in configuration to import it',
                    details: {
                      extension: 'gtfs-ride',
                      filenames: ['ride_feed_info.txt'],
                      tables: ['ride_feed_info'],
                      enabledExtensions: extensions,
                    },
                  },
                ];
              });
        assert.deepEqual(
          report.validation.samples.filter(
            ({ code }) => code === GtfsValidationNoticeCode.EXTENSION_DISABLED,
          ),
          expected,
        );
        assert.equal(
          report.validation.countsByCode[
            GtfsValidationNoticeCode.EXTENSION_DISABLED
          ] ?? 0,
          expected.length,
        );
        assert.deepEqual(
          events
            .filter(
              (event) =>
                event.type === 'validation:notice' &&
                event.notice.code ===
                  GtfsValidationNoticeCode.EXTENSION_DISABLED,
            )
            .map((event) =>
              event.type === 'validation:notice' ? event.notice : undefined,
            ),
          expected,
        );
      } finally {
        sqlite.close();
        await rm(fixture, { recursive: true, force: true });
      }
    });
  }

  test('instances expose immutable defaults and canonically ordered extensions', async () => {
    assert.deepEqual(DEFAULT_GTFS_EXTENSIONS, []);
    assert.equal(Object.isFrozen(DEFAULT_GTFS_EXTENSIONS), true);
    for (const extensions of [undefined, ['tides', 'gtfs-ride']] as const) {
      const gtfs = new Gtfs({
        database: {},
        ...(extensions === undefined ? {} : { extensions }),
      });
      try {
        assert.deepEqual(
          gtfs.extensions,
          extensions === undefined ? [] : ['gtfs-ride', 'tides'],
        );
        assert.equal(Object.isFrozen(gtfs.extensions), true);
      } finally {
        await gtfs.close();
      }
    }
    for (const extensions of [
      ['gtfs-ride', 'gtfs-ride'],
      ['unknown'],
      ['gtfs-schedule'],
    ]) {
      assert.throws(() => new Gtfs({ database: {}, extensions } as never), {
        code: GtfsErrorCode.CONFIG_INVALID,
      });
    }
  });

  test('creates and validates only enabled tables and indexes', () => {
    const sqlite = new Database(':memory:');
    try {
      createSqliteGtfsTables({ database: sqlite, mode: 'recreate' });
      createSqliteGtfsIndexes({ database: sqlite, mode: 'recreate' });
      const defaults = tableNames(sqlite);
      assert.ok(defaults.includes('agency'));
      assert.ok(!defaults.includes('ride_feed_info'));
      assert.ok(!defaults.includes('realtime_snapshots'));
      assert.equal(
        inspectSqliteGtfsSchema({ database: sqlite }).compatible,
        true,
      );

      const rideBeforeCreate = inspectSqliteGtfsSchema({
        database: sqlite,
        extensions: ['gtfs-ride'],
      });
      assert.equal(rideBeforeCreate.compatible, false);
      assert.ok(
        rideBeforeCreate.tableIssues.some(
          ({ tableName, missingTable }) =>
            tableName === 'ride_feed_info' && missingTable,
        ),
      );

      createSqliteGtfsTables({
        database: sqlite,
        mode: 'ensure',
        extensions: ['gtfs-ride'],
      });
      createSqliteGtfsIndexes({
        database: sqlite,
        mode: 'ensure',
        extensions: ['gtfs-ride'],
      });
      assert.equal(
        inspectSqliteGtfsSchema({
          database: sqlite,
          extensions: ['gtfs-ride'],
          includeIndexes: true,
        }).compatible,
        true,
      );
      assert.ok(tableNames(sqlite).includes('ride_feed_info'));
      assert.ok(!tableNames(sqlite).includes('directions'));
    } finally {
      sqlite.close();
    }
  });

  test('imports the explicit database-wide union and notices disabled files', async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), 'gtfs-extensions-'));
    const sqlite = new Database(':memory:');
    try {
      await cp('test/fixtures/complete', fixture, { recursive: true });
      await writeFile(
        path.join(fixture, 'directions.txt'),
        'route_id,direction_id,direction\nroute,0,Outbound\n',
      );
      const report = await importGtfs({
        database: { client: sqlite },
        sources: [
          {
            sourceId: 'first',
            schedule: {
              path: fixture,
              import: { validation: { mode: 'permissive' } },
            },
          },
          {
            sourceId: 'second',
            schedule: {
              path: fixture,
              import: { validation: { mode: 'permissive' } },
            },
          },
        ],
        extensions: ['gtfs-ride'],
        reporting: { level: 'silent' },
      });

      assert.ok(tableNames(sqlite).includes('ride_feed_info'));
      assert.ok(!tableNames(sqlite).includes('directions'));
      assert.equal(
        report.validation.samples.filter(
          ({ code, filename }) =>
            code === GtfsValidationNoticeCode.EXTENSION_DISABLED &&
            filename === 'directions.txt',
        ).length,
        2,
      );
    } finally {
      sqlite.close();
      await rm(fixture, { recursive: true, force: true });
    }
  });

  test('creates exactly the explicitly selected extensions', () => {
    const sqlite = new Database(':memory:');
    try {
      createSqliteGtfsTables({
        database: sqlite,
        mode: 'recreate',
        extensions: fixtureExtensions,
      });
      const physical = new Set(tableNames(sqlite));
      for (const [name, table] of Object.entries(gtfsManifest)) {
        assert.equal(
          physical.has(name),
          table.specification !== 'tods-v1',
          name,
        );
      }
    } finally {
      sqlite.close();
    }
  });
});
