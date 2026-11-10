import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';
import { fixtureExtensions } from '../fixtures/extensions.ts';
import {
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
  sql,
} from 'kysely';

import { Gtfs, GtfsErrorCode, type GtfsReportEvent } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { digestGtfsCanonicalKey } from '../../src/database/storage/key.ts';
import { compiledTables } from '../../src/schema/table-registry.ts';

function sqliteKysely(client: Database.Database): Kysely<GtfsDatabase> {
  return new Kysely<GtfsDatabase>({
    dialect: new SqliteDialect({ database: client }),
  });
}

describe('Gtfs instance', () => {
  test('keeps owned instances, source scope, and data fully independent', async () => {
    const north = new Gtfs({
      database: { path: ':memory:' },
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
      extensions: fixtureExtensions,
    });
    const south = new Gtfs({
      database: {},
      sources: [{ sourceId: 'south' }],
      reporting: { level: 'silent' },
      extensions: fixtureExtensions,
    });

    try {
      await Promise.all([north.schema.recreate(), south.schema.recreate()]);
      await north.database.withKysely({
        callback: async (db) => {
          await sql`insert into agency
            (source_id, agency_id, agency_name, agency_url, agency_timezone,
             _node_gtfs_key)
            values ('north', 'shared', 'North', 'https://north.test', 'UTC',
              ${digestGtfsCanonicalKey(['north', 'shared'])})`.execute(db);
        },
      });
      await south.database.withKysely({
        callback: async (db) => {
          await sql`insert into agency
            (source_id, agency_id, agency_name, agency_url, agency_timezone,
             _node_gtfs_key)
            values ('south', 'shared', 'South', 'https://south.test', 'UTC',
              ${digestGtfsCanonicalKey(['south', 'shared'])})`.execute(db);
        },
      });

      const northNames = await north.database.withKysely({
        callback: async (db) =>
          (
            await sql<{
              agency_name: string;
            }>`select agency_name from agency`.execute(db)
          ).rows,
      });
      const southNames = await south.database.withKysely({
        callback: async (db) =>
          (
            await sql<{
              agency_name: string;
            }>`select agency_name from agency`.execute(db)
          ).rows,
      });
      assert.deepEqual(north.sourceIds, ['north']);
      assert.deepEqual(south.sourceIds, ['south']);
      assert.deepEqual(northNames, [{ agency_name: 'North' }]);
      assert.deepEqual(southNames, [{ agency_name: 'South' }]);
    } finally {
      await Promise.all([north.close(), south.close()]);
    }
  });

  test('exposes immutable manifest-backed table metadata under schema', async () => {
    const gtfs = new Gtfs({ database: {} });
    const another = new Gtfs({ database: {} });
    try {
      assert.equal(
        Object.keys(gtfs.schema.tables).length,
        compiledTables.length,
      );
      assert.deepEqual(gtfs.schema.tables.routes, {
        tableName: 'routes',
        specification: 'gtfs-schedule',
        filename: 'routes.txt',
      });
      assert.equal(Object.isFrozen(gtfs.schema), true);
      assert.equal(Object.isFrozen(gtfs.schema.tables), true);
      assert.equal(Object.isFrozen(gtfs.schema.tables.routes), true);
      assert.equal(gtfs.schema.tables, another.schema.tables);
    } finally {
      await Promise.all([gtfs.close(), another.close()]);
    }
  });

  test('copies and freezes all public instance metadata', async () => {
    const originalReporter = () => undefined;
    const options = {
      database: { path: ':memory:' },
      reporting: { level: 'warn' as const, reporter: originalReporter },
      extensions: ['gtfs-ride'] as const,
      sources: [{ sourceId: 'original' }],
    };
    const gtfs = new Gtfs(options);

    try {
      options.database.path = 'changed.sqlite';
      (options.reporting as { level: string }).level = 'silent';
      options.reporting.reporter = () => {
        throw new Error('mutated reporter');
      };
      (options.extensions as unknown as string[])[0] = 'tides';
      options.sources[0]!.sourceId = 'mutated';

      assert.equal(gtfs.database.dialect, 'sqlite');
      assert.equal(gtfs.database.ownership, 'owned');
      assert.equal(typeof gtfs.database.withKysely, 'function');
      assert.equal(gtfs.reporting.level, 'warn');
      assert.equal(gtfs.reporting.reporter, originalReporter);
      assert.deepEqual(gtfs.extensions, ['gtfs-ride']);
      assert.deepEqual(gtfs.sourceIds, ['original']);
      assert.equal(Object.isFrozen(gtfs.database), true);
      assert.equal(Object.isFrozen(gtfs.schema), true);
      assert.equal(Object.isFrozen(gtfs.reporting), true);
      assert.equal(Object.isFrozen(gtfs.extensions), true);
      assert.equal(Object.isFrozen(gtfs.sourceIds), true);
      assert.equal(Object.isFrozen(gtfs.geojson), true);
      assert.equal(Object.isFrozen(gtfs.query), true);
      assert.deepEqual(Object.keys(gtfs).sort(), [
        'database',
        'extensions',
        'geojson',
        'gtfsPlus',
        'gtfsRide',
        'gtfsToHtml',
        'query',
        'realtime',
        'reporting',
        'schedule',
        'schema',
        'sourceIds',
        'tides',
        'tods',
        'todsV1',
      ]);
    } finally {
      await gtfs.close();
    }
  });

  test('uses one schema lifecycle on raw SQLite and Kysely connections', async () => {
    const rawSqlite = new Database(':memory:');
    const rawInstance = new Gtfs({
      database: {
        client: rawSqlite,
      },
      reporting: { level: 'silent' },
      extensions: fixtureExtensions,
    });
    const portableSqlite = new Database(':memory:');
    const portableDb = sqliteKysely(portableSqlite);
    const portableInstance = new Gtfs({
      database: {
        client: portableDb,
      },
      reporting: { level: 'silent' },
      extensions: fixtureExtensions,
    });

    try {
      const rawCreated = await rawInstance.schema.recreate();
      const portableCreated = await portableInstance.schema.recreate();
      assert.equal(rawCreated.compatible, true);
      assert.equal(portableCreated.compatible, true);
      assert.deepEqual(
        portableSqlite
          .prepare(
            `SELECT name FROM sqlite_master
             WHERE type = 'table' AND name LIKE 'realtime_%'
             ORDER BY name`,
          )
          .pluck()
          .all(),
        [
          'realtime_feed_entities',
          'realtime_feeds',
          'realtime_shapes',
          'realtime_snapshots',
          'realtime_stops',
        ],
      );
      assert.equal((await rawInstance.schema.validate()).compatible, true);
      assert.equal((await portableInstance.schema.validate()).compatible, true);
    } finally {
      await rawInstance.close();
      await portableInstance.close();
      rawSqlite.close();
      await portableDb.destroy();
    }
  });

  test('exposes the same lifecycle metadata for matching Kysely dialects without connecting', async () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const sqlite = new Database(':memory:');
      const pool = async (): Promise<never> => {
        throw new Error('Metadata access must not open a database connection');
      };
      const db = new Kysely<GtfsDatabase>({
        dialect:
          dialect === 'sqlite'
            ? new SqliteDialect({ database: sqlite })
            : dialect === 'postgres'
              ? new PostgresDialect({ pool })
              : new MysqlDialect({ pool }),
      });
      const gtfs = new Gtfs({
        database: { client: db },
      });
      try {
        assert.equal(gtfs.database.dialect, dialect);
        assert.equal(gtfs.database.ownership, 'borrowed');
        assert.equal(gtfs.reporting.level, 'silent');
        assert.equal(Object.isFrozen(gtfs.database), true);
        assert.equal(Object.isFrozen(gtfs.schema), true);
        assert.equal(Object.isFrozen(gtfs.reporting), true);
      } finally {
        await gtfs.close();
        assert.equal(sqlite.open, true);
        await db.destroy();
        if (sqlite.open) {
          sqlite.close();
        }
      }
    }
  });

  test('closes only connections opened by the instance', async () => {
    const borrowedRaw = new Database(':memory:');
    const borrowedRawInstance = new Gtfs({
      database: {
        client: borrowedRaw,
      },
    });
    await borrowedRawInstance.close();
    assert.equal(borrowedRaw.open, true);
    borrowedRaw.close();

    const borrowedSqlite = new Database(':memory:');
    const borrowedDb = sqliteKysely(borrowedSqlite);
    const borrowedInstance = new Gtfs({
      database: {
        client: borrowedDb,
      },
    });
    await borrowedInstance.close();
    assert.equal(borrowedSqlite.open, true);
    await borrowedDb.destroy();

    const anotherBorrowedSqlite = new Database(':memory:');
    const anotherBorrowedDb = sqliteKysely(anotherBorrowedSqlite);
    const anotherBorrowedInstance = new Gtfs({
      database: {
        client: anotherBorrowedDb,
      },
    });
    await anotherBorrowedInstance.database.withKysely({
      callback: (db) => sql`select 1`.execute(db),
    });
    await anotherBorrowedInstance.close();
    assert.equal(anotherBorrowedSqlite.open, true);
    await anotherBorrowedDb.destroy();

    const ownedInstance = new Gtfs({
      database: {},
    });
    assert.equal(ownedInstance.database.ownership, 'owned');
    await ownedInstance.close();
    await ownedInstance.close();
  });

  test('serializes callbacks with lifecycle and waits for them before close', async () => {
    const sqlite = new Database(':memory:');
    const gtfs = new Gtfs({
      database: {
        client: sqlite,
      },
    });
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = gtfs.database.withKysely({
      callback: async () => {
        events.push('first:start');
        await firstGate;
        events.push('first:end');
      },
    });
    const schema = gtfs.schema.ensure();
    const second = gtfs.database.withKysely({
      callback: async (database) => {
        await database.selectFrom('routes').select('route_id').execute();
        events.push('second');
      },
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['first:start']);

    const closing = gtfs.close();
    await assert.rejects(
      gtfs.database.withKysely({ callback: () => undefined }),
      (error: unknown) =>
        (error as { code?: unknown }).code === GtfsErrorCode.INSTANCE_CLOSED,
    );
    releaseFirst();
    await Promise.all([first, schema, second, closing]);
    assert.deepEqual(events, ['first:start', 'first:end', 'second']);
    assert.equal(gtfs.isClosed, true);
    assert.equal(sqlite.open, true);
    sqlite.close();
  });

  test('keeps reporting configuration and source validation instance-local', async () => {
    const firstEvents: GtfsReportEvent[] = [];
    const secondEvents: GtfsReportEvent[] = [];
    const first = new Gtfs({
      database: {},
      sources: [{ sourceId: 'first' }],
      reporting: {
        reporter: (event) => firstEvents.push(event),
      },
    });
    const second = new Gtfs({
      database: {},
      sources: [{ sourceId: 'second' }],
      reporting: {
        reporter: (event) => secondEvents.push(event),
      },
    });

    try {
      first.reporting.log({ level: 'info', message: 'first only' });
      second.reporting.log({ level: 'warn', message: 'second only' });
      assert.deepEqual(
        firstEvents.map(({ level, message }) => ({ level, message })),
        [{ level: 'info', message: 'first only' }],
      );
      assert.deepEqual(
        secondEvents.map(({ level, message }) => ({ level, message })),
        [{ level: 'warn', message: 'second only' }],
      );
      assert.throws(
        () =>
          new Gtfs({
            database: {},
            sources: [{ sourceId: 'duplicate' }, { sourceId: 'duplicate' }],
          }),
        (error: unknown) =>
          (error as { code?: unknown }).code === GtfsErrorCode.CONFIG_INVALID,
      );
    } finally {
      await first.close();
      await second.close();
    }
  });
});
