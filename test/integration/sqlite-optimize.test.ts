import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import {
  applySqliteGtfsTablePlan,
  applySqliteGtfsIndexPlan,
} from '../../src/database/sqlite/schema-writer.ts';
import {
  applyKyselyGtfsTablePlan,
  applyKyselyGtfsIndexPlan,
} from '../../src/database/kysely/schema-writer.ts';

const table = compileTable(
  defineGtfsTable({
    filename: null,
    tableName: 'optimization_fixture',
    specification: 'gtfs-schedule',
    presence: 'optional',
    keyStrategy: 'columns',
    primaryKey: ['id'],
    fields: {
      id: { kind: 'id', presence: 'required' },
      category: { kind: 'text' },
    },
    indexes: ['category', ['category', 'id']],
  }),
);

for (const adapter of ['native', 'kysely'] as const) {
  for (const mode of ['ensure', 'recreate'] as const) {
    test(`${adapter} SQLite ${mode} optimizes once after all indexes and populates planning statistics`, async (t) => {
      const statements: string[] = [];
      const native = new Database(':memory:', {
        verbose: (statement) => statements.push(String(statement)),
      });
      const database = new Kysely({
        dialect: new SqliteDialect({ database: native }),
      });
      t.after(() => database.destroy());
      const plan = createGtfsStoragePlan({
        dialect: 'sqlite',
        mode,
        tables: [table],
      });
      if (adapter === 'native') {
        applySqliteGtfsTablePlan(native, plan);
      } else {
        await applyKyselyGtfsTablePlan(database, plan);
      }
      const insert = native.prepare(
        'INSERT INTO optimization_fixture (source_id, id, category) VALUES (?, ?, ?)',
      );
      native.transaction(() => {
        for (let index = 0; index < 100; index += 1) {
          insert.run('source', String(index), String(index % 5));
        }
      })();
      statements.length = 0;
      const applyIndexes = (options = plan) =>
        adapter === 'native'
          ? applySqliteGtfsIndexPlan(native, options)
          : applyKyselyGtfsIndexPlan(database, options);
      assert.equal((await applyIndexes()).compatible, true);
      assert.equal(
        statements.filter((statement) => statement === 'PRAGMA optimize')
          .length,
        1,
      );
      assert.ok(
        statements.indexOf('PRAGMA optimize') >
          statements.findLastIndex((statement) =>
            statement.startsWith('CREATE INDEX'),
          ),
      );
      if (adapter === 'native') {
        assert.ok(
          statements.indexOf('PRAGMA optimize') > statements.indexOf('COMMIT'),
        );
      }
      const stats = native
        .prepare('SELECT idx FROM sqlite_stat1 WHERE tbl = ?')
        .pluck()
        .all(table.tableName);
      assert.ok(stats.includes('idx_optimization_fixture_category'));
      assert.ok(stats.includes('idx_optimization_fixture_category_id'));
      for (const nextMode of ['ensure', 'validate'] as const) {
        statements.length = 0;
        assert.equal(
          (await applyIndexes({ ...plan, mode: nextMode })).compatible,
          true,
        );
        assert.equal(statements.includes('PRAGMA optimize'), false);
      }
    });
  }
}

test('Kysely SQLite optimization stays inside the caller transaction and is skipped on index failure', async (t) => {
  const statements: string[] = [];
  const native = new Database(':memory:', {
    verbose: (statement) => statements.push(String(statement)),
  });
  const database = new Kysely({
    dialect: new SqliteDialect({ database: native }),
  });
  t.after(() => database.destroy());
  const plan = createGtfsStoragePlan({ dialect: 'sqlite', tables: [table] });
  await applyKyselyGtfsTablePlan(database, plan);
  const failure = new Error('Abort caller transaction');
  await assert.rejects(
    database.transaction().execute(async (transaction) => {
      await applyKyselyGtfsIndexPlan(transaction, plan);
      assert.equal(native.inTransaction, true);
      assert.equal(
        statements.filter((statement) => statement === 'PRAGMA optimize')
          .length,
        1,
      );
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    native
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
      )
      .all(),
    [],
  );
  statements.length = 0;
  const failingPlan = createGtfsStoragePlan({
    dialect: 'sqlite',
    mode: 'recreate',
    tables: [table, { ...table, tableName: 'missing_table' }],
  });
  await assert.rejects(
    applyKyselyGtfsIndexPlan(database, failingPlan),
    /no such table/,
  );
  assert.equal(statements.includes('PRAGMA optimize'), false);
});
