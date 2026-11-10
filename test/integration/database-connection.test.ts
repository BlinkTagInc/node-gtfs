import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
  MssqlAdapter,
  sql,
} from 'kysely';

import {
  Gtfs,
  GtfsErrorCategory,
  GtfsErrorCode,
  importGtfs,
} from '../../src/index.ts';
import { initializeGtfsConnection } from '../../src/database/connection.ts';
import { resolveGtfsConfig } from '../../src/config/resolver.ts';
import { createFeedFixture } from '../helpers/test-utils.ts';

const configError = {
  code: GtfsErrorCode.CONFIG_INVALID,
  category: GtfsErrorCategory.CONFIG,
};

describe('database connection initialization', () => {
  test('rejects invalid clients before instance setup or automatic import', async () => {
    for (const client of [
      {},
      [],
      new Date(),
      null,
      false,
      'postgres',
      { prepare() {} },
      { selectFrom() {} },
    ]) {
      const database = { client } as never;
      assert.throws(() => initializeGtfsConnection(database), configError);
      assert.throws(() => new Gtfs({ database }), configError);
      await assert.rejects(
        importGtfs({
          database,
          extensions: 'auto',
          sources: [{ schedule: { path: 'not-read-for-an-invalid-client' } }],
        }),
        configError,
      );
    }
  });

  test('configuration failures leave a supplied client usable and untouched', async (t) => {
    const client = new Database(':memory:');
    t.after(() => client.close());
    const prepare = t.mock.method(client, 'prepare', () => {
      throw new Error('Invalid configuration must not reach SQL');
    });
    try {
      for (const extra of [{ path: ':memory:' }, { durability: 'safe' }]) {
        const database = { client, ...extra } as never;
        assert.throws(() => new Gtfs({ database }), configError);
        await assert.rejects(
          importGtfs({
            database,
            extensions: 'auto',
            sources: [{ schedule: { path: 'not-read-for-invalid-config' } }],
          }),
          configError,
        );
        assert.equal(client.open, true);
      }
    } finally {
      prepare.mock.restore();
    }
    assert.equal(prepare.mock.callCount(), 0);
    assert.deepEqual(client.prepare('SELECT 1 AS value').get(), { value: 1 });
    assert.deepEqual(
      client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all(),
      [],
    );
  });

  test('derives the native SQLite dialect from a borrowed client', () => {
    const client = new Database(':memory:');
    try {
      const config = resolveGtfsConfig({ database: { client } });
      assert.equal(config.database.dialect, 'sqlite');
      assert.equal(config.database.client, client);
    } finally {
      client.close();
    }
  });

  test('derives every supported Kysely dialect without opening a connection', async () => {
    const pool = async (): Promise<never> => {
      assert.fail('Connection validation must not access the pool');
    };
    const dialects = {
      sqlite: new SqliteDialect({
        database: async () =>
          assert.fail('Connection validation must not open SQLite'),
      }),
      postgres: new PostgresDialect({ pool }),
      mysql: new MysqlDialect({ pool }),
    };
    for (const clientDialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const client = new Kysely({ dialect: dialects[clientDialect] });
      try {
        const database = { client };
        const connection = initializeGtfsConnection(database);
        assert.equal(connection.database, client);
        assert.equal(connection.ownership, 'borrowed');
        assert.equal(connection.sqlite, null);
        assert.equal(
          resolveGtfsConfig({ database }).database.dialect,
          clientDialect,
        );
        const gtfs = new Gtfs({ database });
        assert.equal(gtfs.database.dialect, clientDialect);
        assert.equal(gtfs.database.ownership, 'borrowed');
        await gtfs.close();
      } finally {
        await client.destroy();
      }
    }
  });

  test('rejects unsupported Kysely adapters without opening a connection', async () => {
    const sqliteDialect = new SqliteDialect({
      database: async () => assert.fail('Must not connect'),
    });
    const client = new Kysely({
      dialect: {
        createAdapter: () => new MssqlAdapter(),
        createDriver: () => sqliteDialect.createDriver(),
        createIntrospector: (database) =>
          sqliteDialect.createIntrospector(database),
        createQueryCompiler: () => sqliteDialect.createQueryCompiler(),
      },
    });
    try {
      assert.throws(() => new Gtfs({ database: { client } }), configError);
      await assert.rejects(
        importGtfs({
          database: { client },
          extensions: 'auto',
          sources: [
            { schedule: { path: 'not-read-for-an-unsupported-client' } },
          ],
        }),
        configError,
      );
    } finally {
      await client.destroy();
    }
  });

  test('rejects closed native SQLite clients', async () => {
    const client = new Database(':memory:');
    client.close();
    const database = { client } as const;
    assert.throws(() => new Gtfs({ database }), configError);
    await assert.rejects(
      importGtfs({
        database,
        extensions: 'auto',
        sources: [{ schedule: { path: 'not-read-for-a-closed-client' } }],
      }),
      configError,
    );
  });

  test('automatic import closes owned SQLite connections on success and failure', async (t) => {
    const closed: Database.Database[] = [];
    const close = Database.prototype.close;
    t.mock.method(
      Database.prototype,
      'close',
      function (this: Database.Database) {
        closed.push(this);
        return close.call(this);
      },
    );
    const fixture = await createFeedFixture({ base: 'complete' });
    try {
      const result = await importGtfs({
        database: { path: ':memory:' },
        extensions: 'auto',
        sources: [{ schedule: { path: fixture.path } }],
      });
      assert.equal(result.success, true);
      assert.equal(closed.length, 2);
      assert.equal(
        closed.every((database) => !database.open),
        true,
      );

      await assert.rejects(
        importGtfs({
          database: { path: ':memory:' },
          extensions: 'auto',
          sources: [{ schedule: { path: `${fixture.path}/missing` } }],
        }),
      );
      assert.equal(closed.length, 3);
      assert.equal(
        closed.every((database) => !database.open),
        true,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  for (const adapter of ['native', 'kysely'] as const) {
    test(`automatic import preserves borrowed ${adapter} connections on success and failure`, async () => {
      const sqlite = new Database(':memory:');
      const kysely = new Kysely({
        dialect: new SqliteDialect({ database: sqlite }),
      });
      const database = {
        client: adapter === 'native' ? sqlite : kysely,
      } as const;
      const fixture = await createFeedFixture({ base: 'complete' });
      try {
        const result = await importGtfs({
          database,
          extensions: 'auto',
          sources: [{ schedule: { path: fixture.path } }],
        });
        assert.equal(result.success, true);
        assert.equal(sqlite.open, true);
        await assert.rejects(
          importGtfs({
            database,
            extensions: 'auto',
            sources: [{ schedule: { path: `${fixture.path}/missing` } }],
          }),
        );
        assert.equal(sqlite.open, true);
        assert.equal(
          (await sql`select 1 as value`.execute(kysely)).rows.length,
          1,
        );
      } finally {
        await kysely.destroy();
        if (sqlite.open) {
          sqlite.close();
        }
        await fixture.cleanup();
      }
    });
  }
});
