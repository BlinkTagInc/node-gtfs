import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { openSqliteDatabase } from '../../src/database/sqlite/connection.ts';
import {
  createSqliteGtfsTables,
  createSqliteGtfsIndexes,
} from '../../src/database/sqlite/schema-writer.ts';
import {
  createKyselyGtfsTables,
  createKyselyGtfsIndexes,
} from '../../src/database/kysely/schema-writer.ts';
import { inspectSqliteGtfsSchema } from '../../src/database/sqlite/schema-inspector.ts';
import { inspectKyselyGtfsSchema } from '../../src/database/kysely/schema-inspector.ts';
import { createConsoleReporter } from '../../src/reporting/reporters.ts';

test('SQLite open rejects invalid options instead of returning a fallback database', () => {
  for (const options of [
    { client: null },
    { client: false },
    { client: {} },
    { path: 5 },
    { unknown: true },
    ':memory:',
    false,
    null,
  ]) {
    assert.throws(() => openSqliteDatabase(options as never), {
      code: 'GTFS_CONFIG_INVALID',
    });
  }
  const database = new Database(':memory:');
  try {
    assert.equal(openSqliteDatabase({ client: database }), database);
    assert.throws(
      () => openSqliteDatabase({ client: database, path: ':memory:' }),
      { code: 'GTFS_CONFIG_INVALID' },
    );
  } finally {
    database.close();
  }
  assert.throws(() => openSqliteDatabase({ client: database }), {
    code: 'GTFS_CONFIG_INVALID',
  });
});

test('every low-level schema entry point rejects unknown and invalid options before SQL', async (t) => {
  const native = new Database(':memory:');
  const database = new Kysely({
    dialect: new SqliteDialect({ database: native }),
  });
  t.after(() => database.destroy());
  const prepare = t.mock.method(native, 'prepare', () => {
    throw new Error('Unexpected SQL');
  });
  const operations = [
    (options: object) =>
      createSqliteGtfsTables({ database: native, ...options }),
    (options: object) =>
      createSqliteGtfsIndexes({ database: native, ...options }),
    (options: object) =>
      inspectSqliteGtfsSchema({ database: native, ...options }),
    (options: object) =>
      createKyselyGtfsTables({ database, dialect: 'sqlite', ...options }),
    (options: object) =>
      createKyselyGtfsIndexes({ database, dialect: 'sqlite', ...options }),
    (options: object) =>
      inspectKyselyGtfsSchema({ database, dialect: 'sqlite', ...options }),
  ];
  for (const operation of operations) {
    for (const options of [{ unknown: true }, { mode: 'invalid' }]) {
      await assert.rejects(async () => operation(options), {
        code: 'GTFS_CONFIG_INVALID',
      });
    }
  }
  assert.equal(prepare.mock.callCount(), 0);
});

test('console reporter does not ignore unknown options or coerce animation settings', () => {
  for (const options of [{ unknown: true }, { animateProgress: 'yes' }]) {
    assert.throws(() => createConsoleReporter(options as never), {
      code: 'GTFS_CONFIG_INVALID',
    });
  }
});
