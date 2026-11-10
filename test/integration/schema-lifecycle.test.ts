import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { describe, it } from 'node:test';
import {
  Gtfs,
  GtfsErrorCode,
  importGtfs,
  refreshGtfsRealtime,
  type GtfsReportEvent,
} from '../../src/index.ts';
import {
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
} from '../../src/database/sqlite/schema-writer.ts';
import { digestGtfsCanonicalKey } from '../../src/database/storage/key.ts';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';

describe('GTFS schema lifecycle:', () => {
  for (const adapter of ['native', 'kysely'] as const) {
    it(`imports and refreshes preserve existing tables with the ${adapter} adapter`, async (t) => {
      const sqlite = new Database(':memory:');
      const client =
        adapter === 'native'
          ? sqlite
          : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
      const database = { client };
      const events: GtfsReportEvent[] = [];
      const gtfs = new Gtfs({
        database,
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'current',
            schedule: { path: 'test/fixtures/complete' },
            realtime: {
              feeds: [{ type: 'alerts', url: 'https://example.test/alerts' }],
            },
          },
        ],
        reporting: { reporter: (event) => events.push(event) },
      });
      let failDownload = false;
      const payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 1,
        entities: [
          {
            id: 'alert',
            alert: {
              headerText: { translation: [{ text: 'Current alert' }] },
              descriptionText: {
                translation: [{ text: 'Current alert details' }],
              },
              informedEntity: [{ routeId: 'route' }],
            },
          },
        ],
      });
      t.mock.method(
        globalThis,
        'fetch',
        async () =>
          new Response(failDownload ? '' : payload, {
            status: failDownload ? 401 : 200,
          }),
      );
      try {
        assert.equal((await gtfs.import()).success, true);
        await importGtfs({
          database,
          sources: [
            {
              sourceId: 'other',
              schedule: { path: 'test/fixtures/complete' },
            },
          ],
          reporting: { level: 'silent' },
        });
        sqlite.exec(
          'CREATE INDEX application_route_index ON routes (route_id, route_type); CREATE TABLE application_data (id INTEGER); INSERT INTO application_data VALUES (1)',
        );
        const readSchedule = () =>
          sqlite
            .prepare('SELECT * FROM routes ORDER BY source_id, route_id')
            .all();
        const schedule = readSchedule();
        assert.equal((await gtfs.realtime.refresh()).success, true);
        assert.deepEqual(readSchedule(), schedule);
        const alerts = sqlite.prepare('SELECT * FROM alerts').all();
        assert.equal(alerts.length, 1);
        failDownload = true;
        await assert.rejects(gtfs.realtime.refresh(), {
          code: GtfsErrorCode.DOWNLOAD_HTTP_FAILED,
        });
        assert.deepEqual(readSchedule(), schedule);
        assert.deepEqual(sqlite.prepare('SELECT * FROM alerts').all(), alerts);
        assert.equal((await gtfs.import()).success, true);
        assert.deepEqual(readSchedule(), schedule);
        assert.notEqual(
          sqlite
            .prepare(
              "SELECT 1 FROM sqlite_schema WHERE name = 'application_route_index'",
            )
            .get(),
          undefined,
        );
        assert.deepEqual(
          sqlite.prepare('SELECT * FROM application_data').all(),
          [{ id: 1 }],
        );
        assert.equal(
          events.some((event) => event.type === 'schema:recreate'),
          false,
        );
      } finally {
        await gtfs.close();
        if (client instanceof Kysely) {
          await client.destroy();
        } else {
          sqlite.close();
        }
      }
    });

    it(`Realtime refresh rejects schema drift without fetching or replacing data with the ${adapter} adapter`, async (t) => {
      const sqlite = new Database(':memory:');
      const client =
        adapter === 'native'
          ? sqlite
          : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
      const fetch = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Must not fetch');
      });
      try {
        sqlite.exec(
          "CREATE TABLE agency (sentinel TEXT); INSERT INTO agency VALUES ('kept')",
        );
        await assert.rejects(
          refreshGtfsRealtime({
            database: { client },
            extensions: ['gtfs-realtime'],
            sources: [
              {
                realtime: {
                  feeds: [
                    { type: 'alerts', url: 'https://example.test/alerts' },
                  ],
                },
              },
            ],
            reporting: { level: 'silent' },
          }),
          { code: GtfsErrorCode.SCHEMA_INVALID },
        );
        assert.deepEqual(sqlite.prepare('SELECT sentinel FROM agency').all(), [
          { sentinel: 'kept' },
        ]);
        assert.equal(fetch.mock.callCount(), 0);
      } finally {
        if (client instanceof Kysely) {
          await client.destroy();
        } else {
          sqlite.close();
        }
      }
    });
  }

  it('returns structured SQLite differences from explicit validation without writing', async () => {
    const db = new Database(':memory:');
    const gtfs = new Gtfs({
      database: { client: db },
      reporting: { level: 'silent' },
    });
    try {
      const before = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all();
      const inspection = await gtfs.schema.validate();
      const after = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all();

      assert.ok(!inspection.compatible);
      assert.ok(inspection.tableIssues[0]!.missingTable);
      assert.ok(
        inspection.tableIssues.some(
          ({ missingIndexes }) => missingIndexes.length > 0,
        ),
      );
      assert.deepEqual(after, before);
    } finally {
      await gtfs.close();
      db.close();
    }
  });

  it('rejects every supplied schema-method argument before querying', async () => {
    const sqlite = new Database(':memory:');
    let queryCount = 0;
    const database = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
      log() {
        queryCount += 1;
      },
    });
    const gtfs = new Gtfs({
      database: { client: database },
      reporting: { level: 'silent' },
    });
    try {
      for (const method of ['ensure', 'validate', 'recreate'] as const) {
        for (const args of [
          [{}],
          [undefined],
          [null],
          [[]],
          [true],
          [1],
          ['unexpected'],
          [{}, {}],
        ]) {
          await assert.rejects(
            () => Reflect.apply(gtfs.schema[method], undefined, args),
            (error: unknown) =>
              (error as { code?: unknown }).code ===
              GtfsErrorCode.CONFIG_INVALID,
          );
        }
      }
      assert.equal(queryCount, 0);
    } finally {
      await gtfs.close();
      await database.destroy();
    }
  });

  it('rejects existing schema drift without replacing the drifted table', async () => {
    const db = new Database(':memory:');
    try {
      db.exec('CREATE TABLE agency (sentinel TEXT)');
      db.prepare('INSERT INTO agency (sentinel) VALUES (?)').run('kept');

      await assert.rejects(
        importGtfs({
          database: { client: db },
          sources: [
            {
              sourceId: 'test',
              schedule: { path: 'not-read-after-schema-drift' },
            },
          ],
          reporting: { level: 'silent' },
        }),
        (error: unknown) => {
          const candidate = error as {
            code?: string;
            details?: {
              schema?: { tableIssues?: Array<{ tableName: string }> };
            };
          };
          return (
            candidate.code === 'GTFS_SCHEMA_INVALID' &&
            candidate.details?.schema?.tableIssues?.some(
              ({ tableName }) => tableName === 'agency',
            ) === true
          );
        },
      );
      const row = db.prepare('SELECT sentinel FROM agency').get();
      assert.deepEqual(row, { sentinel: 'kept' });
    } finally {
      db.close();
    }
  });

  it('does not drop or truncate existing SQLite tables in ensure mode', () => {
    const db = new Database(':memory:');
    try {
      createSqliteGtfsTables({ database: db, mode: 'recreate' });
      db.prepare(
        `INSERT INTO agency
          (source_id, agency_id, agency_name, agency_url, agency_timezone, _node_gtfs_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        'test',
        'kept',
        'Kept Transit',
        'https://example.com',
        'Etc/UTC',
        digestGtfsCanonicalKey(['test', 'kept']),
      );

      const inspection = createSqliteGtfsTables({
        database: db,
        mode: 'ensure',
      });
      const row = db.prepare('SELECT agency_id FROM agency').get() as {
        agency_id: string;
      };

      assert.ok(inspection.compatible);
      assert.deepEqual(row.agency_id, 'kept');
    } finally {
      db.close();
    }
  });

  it('reports destructive scope before recreating SQLite tables', async () => {
    const db = new Database(':memory:');
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: { client: db },
      reporting: {
        reporter(event) {
          if (event.type === 'schema:recreate') {
            assert.equal(
              db.prepare('SELECT sentinel FROM agency').get() !== undefined,
              true,
            );
          }
          events.push(event);
        },
      },
    });

    try {
      db.exec(
        "CREATE TABLE agency (sentinel TEXT); INSERT INTO agency VALUES ('old'); CREATE TABLE application_data (id INTEGER); INSERT INTO application_data VALUES (1)",
      );
      const inspection = await gtfs.schema.recreate();
      assert.equal(inspection.compatible, true);
      assert.deepEqual(db.prepare('SELECT * FROM agency').all(), []);
      assert.deepEqual(db.prepare('SELECT * FROM application_data').all(), [
        { id: 1 },
      ]);

      assert.ok(
        events.some(
          (event) =>
            event.type === 'schema:recreate' &&
            event.level === 'warn' &&
            event.message.includes(
              'existing data in those tables will be deleted',
            ),
        ),
      );
    } finally {
      await gtfs.close();
      db.close();
    }
  });

  it('uses the same explicit read-only validation contract through Kysely', async () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const gtfs = new Gtfs({
      database: { client: db },
      reporting: { level: 'silent' },
    });

    try {
      const inspection = await gtfs.schema.validate();
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all();

      assert.ok(!inspection.compatible);
      assert.ok(
        inspection.tableIssues.some(
          ({ missingIndexes }) => missingIndexes.length > 0,
        ),
      );
      assert.deepEqual(tables, []);
    } finally {
      await gtfs.close();
      await db.destroy();
    }
  });

  it('preserves existing rows when strict source validation fails before writes', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-failed-import-'));
    const db = new Database(':memory:');

    try {
      createSqliteGtfsTables({
        database: db,
        mode: 'recreate',
      });
      createSqliteGtfsIndexes({ database: db, mode: 'ensure' });
      db.prepare(
        `INSERT INTO agency
          (source_id, agency_id, agency_name, agency_url, agency_timezone, _node_gtfs_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        'test',
        'published',
        'Published Transit',
        'https://example.com',
        'Etc/UTC',
        digestGtfsCanonicalKey(['test', 'published']),
      );
      await writeFile(
        path.join(fixturePath, 'agency.txt'),
        [
          'agency_id,agency_name,agency_timezone',
          'new,New Transit,Etc/UTC',
          '',
        ].join('\n'),
      );

      await assert.rejects(
        importGtfs({
          database: { client: db },
          sources: [{ sourceId: 'test', schedule: { path: fixturePath } }],
          reporting: { level: 'silent' },
        }),
      );
      const ids = db
        .prepare('SELECT agency_id FROM agency ORDER BY agency_id')
        .all() as Array<{ agency_id: string }>;
      assert.deepEqual(ids, [{ agency_id: 'published' }]);
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
