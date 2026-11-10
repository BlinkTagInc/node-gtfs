import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { Gtfs, importGtfs } from '../../src/index.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import { assertCompatibleGtfsSchema } from '../../src/database/schema-lifecycle.ts';
import { createDummyDialect } from '../helpers/kysely-dialect.ts';

for (const adapter of ['native', 'kysely'] as const) {
  test(`schema errors identify the connected SQLite file (${adapter})`, async (t) => {
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), 'gtfs-schema-error-')),
    );
    const databasePath = path.join(directory, 'existing.sqlite');
    const sqlite = new Database(databasePath);
    sqlite.exec(
      "CREATE TABLE agency (sentinel TEXT); INSERT INTO agency VALUES ('kept')",
    );
    const client =
      adapter === 'native'
        ? sqlite
        : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    const options = {
      database: { client },
      extensions: ['gtfs-realtime'] as const,
      sources: [
        {
          schedule: { path: 'test/fixtures/complete' },
          realtime: {
            feeds: [
              { type: 'alerts' as const, url: 'https://example.test/alerts' },
            ],
          },
        },
      ],
      reporting: { level: 'silent' as const },
    };
    const gtfs = new Gtfs(options);
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('Schema preflight must reject before downloading');
    });
    try {
      for (const [name, operation] of [
        ['schema ensure', () => gtfs.schema.ensure()],
        ['instance import', () => gtfs.import()],
        ['standalone import', () => importGtfs(options)],
        ['Realtime refresh', () => gtfs.realtime.refresh()],
        [
          'export',
          () =>
            gtfs.export({ outputDirectory: path.join(directory, 'export') }),
        ],
        ['repository', async () => gtfs.schedule.routes.all()],
      ] as const) {
        await t.test(name, async () => {
          await assert.rejects(operation, (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
            assert.ok(
              error.message.includes(
                `existing SQLite database at ${JSON.stringify(databasePath)}`,
              ),
            );
            assert.equal(error.details?.path, databasePath);
            assert.equal(error.details?.databaseDialect, 'sqlite');
            assert.ok(error.details?.schema);
            if (name === 'instance import') {
              assert.match(
                error.message,
                /enabled table "_node_gtfs_source_state" is missing/,
              );
            }
            return true;
          });
          assert.deepEqual(sqlite.prepare('SELECT * FROM agency').all(), [
            { sentinel: 'kept' },
          ]);
        });
      }
      assert.equal(fetch.mock.callCount(), 0);
    } finally {
      await gtfs.close();
      if (client instanceof Kysely) {
        await client.destroy();
      } else {
        sqlite.close();
      }
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('schema errors resolve a configured relative SQLite path', async () => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), 'gtfs-schema-path-')),
  );
  const databasePath = path.join(directory, 'existing.sqlite');
  const sqlite = new Database(databasePath);
  sqlite.exec('CREATE TABLE agency (sentinel TEXT)');
  sqlite.close();
  try {
    await assert.rejects(
      importGtfs({
        database: { path: path.relative(process.cwd(), databasePath) },
        sources: [{ schedule: { path: 'test/fixtures/complete' } }],
        reporting: { level: 'silent' },
      }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        assert.equal(error.details?.path, databasePath);
        assert.ok(error.message.includes(JSON.stringify(databasePath)));
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('in-memory schema errors do not invent a filesystem path', async () => {
  const gtfs = new Gtfs({
    database: { path: ':memory:' },
    reporting: { level: 'silent' },
  });
  try {
    await assert.rejects(
      async () => gtfs.schedule.routes.all(),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        assert.match(
          error.message,
          /SQLite database \(in-memory or temporary\)/,
        );
        assert.equal(error.details?.path, undefined);
        return true;
      },
    );
  } finally {
    await gtfs.close();
  }
});

test('failed database identity lookup preserves the schema error', async () => {
  await assert.rejects(
    assertCompatibleGtfsSchema(
      { compatible: false, tableIssues: [] },
      {
        dialect: 'postgres',
        database: {
          getExecutor() {
            throw new Error('Diagnostic lookup failed');
          },
        },
      },
    ),
    (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
      assert.match(
        error.message,
        /PostgreSQL database has an incompatible GTFS schema/,
      );
      assert.doesNotMatch(error.message, /Diagnostic lookup failed/);
      return true;
    },
  );
});

for (const dialect of ['postgres', 'mysql'] as const) {
  test(`schema error uses the ${dialect} database-name lookup result`, async (t) => {
    const database = new Kysely({ dialect: createDummyDialect(dialect) });
    const execute = t.mock.method(
      database.getExecutor(),
      'executeQuery',
      async () => ({
        rows: [{ name: 'transit_data' }],
      }),
    );
    try {
      await assertCompatibleGtfsSchema(
        { compatible: true, tableIssues: [] },
        { database, dialect },
      );
      assert.equal(execute.mock.callCount(), 0);
      await assert.rejects(
        assertCompatibleGtfsSchema(
          { compatible: false, tableIssues: [] },
          { database, dialect },
        ),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
          assert.equal(error.details?.databaseName, 'transit_data');
          assert.equal(error.details?.databaseDialect, dialect);
          assert.equal(error.details?.path, undefined);
          assert.match(
            error.message,
            /existing (PostgreSQL|MySQL) database "transit_data"/,
          );
          return true;
        },
      );
      assert.equal(execute.mock.callCount(), 1);
      assert.equal(
        execute.mock.calls[0]?.arguments[0]?.sql,
        dialect === 'postgres'
          ? 'SELECT current_database() AS name'
          : 'SELECT DATABASE() AS name',
      );
    } finally {
      await database.destroy();
    }
  });
}
