/**
 * Captures native SQLite DDL and SQL compiled by the Kysely adapters for schema
 * snapshot generation. Compilation uses a dummy driver, never a remote server.
 */
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  Kysely,
  DummyDriver,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';
import {
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
} from '../../src/database/sqlite/schema-writer.ts';
import {
  applyKyselyGtfsIndexPlan,
  applyKyselyGtfsTablePlan,
} from '../../src/database/kysely/schema-writer.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { gtfsScheduleReferenceRevision } from '../../src/schema/manifest.ts';
import { compiledTables } from '../../src/schema/table-registry.ts';
import { sourceStateTable } from '../../src/database/source-state.ts';
import { fixtureExtensions } from '../../test/fixtures/extensions.ts';

export function createSqliteSchemaSnapshot() {
  const database = new Database(':memory:');
  try {
    createSqliteGtfsTables({
      database,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });
    createSqliteGtfsIndexes({
      database,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });
    const statements = database
      .prepare(
        `
      SELECT type, name, tbl_name AS tableName, sql
      FROM sqlite_master
      WHERE type IN ('table', 'index') AND sql IS NOT NULL
      ORDER BY tbl_name, type, name
    `,
      )
      .all()
      .map((statement) => ({
        ...statement,
        sql: statement.sql.replaceAll(/\s+/g, ' ').trim(),
      }));
    return {
      formatVersion: 1,
      scheduleReferenceRevision: gtfsScheduleReferenceRevision,
      statements,
    };
  } finally {
    database.close();
  }
}

const dialectClasses = {
  sqlite: [SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler],
  postgres: [PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler],
  mysql: [MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler],
};

export async function createKyselySchemaSnapshot(dialect) {
  const [Adapter, Introspector, Compiler] = dialectClasses[dialect];
  const variants = [];
  // The two TODS versions cannot share a database. The second variant records
  // only its additional tables so the common Schedule schema is not duplicated.
  for (const { name, extensions } of [
    { name: 'current', extensions: fixtureExtensions },
    { name: 'tods-v1', extensions: ['tods-v1'] },
  ]) {
    const completePlan = createGtfsStoragePlan({
      dialect,
      mode: 'recreate',
      extensions,
    });
    const plan =
      name === 'current'
        ? completePlan
        : {
            ...completePlan,
            tables: completePlan.tables.filter(
              ({ table }) => table.specification === 'tods-v1',
            ),
          };
    const statements = [];
    const database = new Kysely({
      dialect: {
        createDriver: () => new DummyDriver(),
        createAdapter: () => new Adapter(),
        createIntrospector: (db) => new Introspector(db),
        createQueryCompiler: () => new Compiler(),
      },
      log(event) {
        if (
          event.level === 'query' &&
          /^create (table|index) /i.test(event.query.sql)
        ) {
          statements.push({
            sql: event.query.sql,
            parameters: event.query.parameters,
          });
        }
      },
    });
    try {
      // Inspection sees an empty database; only compilation is under test here.
      await applyKyselyGtfsTablePlan(database, plan);
      await applyKyselyGtfsIndexPlan(database, plan);
      assert.equal(
        statements.filter(({ sql }) => /^create table /i.test(sql)).length,
        plan.tables.length,
      );
      assert.equal(
        statements.filter(({ sql }) => /^create index /i.test(sql)).length,
        plan.tables.reduce((count, table) => count + table.indexes.length, 0),
      );
      variants.push({
        name,
        extensions,
        tables: plan.tables.map(({ table }) => table.tableName),
        statements,
      });
    } finally {
      await database.destroy();
    }
  }
  assert.deepEqual(
    variants.flatMap(({ tables }) => tables).sort(),
    [sourceStateTable, ...compiledTables]
      .map(({ tableName }) => tableName)
      .sort(),
    'Snapshot variants must cover every registered table',
  );
  return {
    formatVersion: 1,
    scheduleReferenceRevision: gtfsScheduleReferenceRevision,
    adapter: 'kysely',
    dialect,
    verification: 'sql-compilation',
    variants,
  };
}
