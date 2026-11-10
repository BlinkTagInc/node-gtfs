import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import {
  applySqliteGtfsTablePlan,
  applySqliteGtfsIndexPlan,
} from '../../src/database/sqlite/schema-writer.ts';

for (const { rows, populated, partial } of [
  { rows: 0, populated: 0, partial: false },
  { rows: 10, populated: 0, partial: true },
  { rows: 10, populated: 1, partial: true },
  { rows: 10, populated: 2, partial: false },
]) {
  test(`SQLite indexes preserve column order and sparse predicates for ${populated}/${rows} populated rows`, () => {
    const table = compileTable(
      defineGtfsTable({
        filename: null,
        tableName: 'index_fixture',
        specification: 'gtfs-schedule',
        presence: 'optional',
        keyStrategy: 'none',
        storageKey: null,
        fields: { sparse: { kind: 'text' }, dense: { kind: 'text' } },
        indexes: ['sparse', ['dense', 'sparse']],
      }),
    );
    const plan = createGtfsStoragePlan({ dialect: 'sqlite', tables: [table] });
    const before = JSON.stringify(plan);
    const database = new Database(':memory:');
    try {
      assert.equal(applySqliteGtfsTablePlan(database, plan).compatible, true);
      const insert = database.prepare(
        'INSERT INTO index_fixture (source_id, "sparse", dense) VALUES (?, ?, ?)',
      );
      for (let row = 0; row < rows; row += 1) {
        insert.run('source', row < populated ? 'value' : null, 'dense');
      }
      assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
      const indexes = database
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'index' ORDER BY name",
        )
        .all();
      assert.deepEqual(indexes, [
        {
          name: 'idx_index_fixture_dense_sparse',
          sql: 'CREATE INDEX "idx_index_fixture_dense_sparse" ON "index_fixture" ("dense", "sparse")',
        },
        {
          name: 'idx_index_fixture_source_id',
          sql: 'CREATE INDEX "idx_index_fixture_source_id" ON "index_fixture" ("source_id")',
        },
        {
          name: 'idx_index_fixture_sparse',
          sql:
            'CREATE INDEX "idx_index_fixture_sparse" ON "index_fixture" ("sparse")' +
            (partial ? ' WHERE "sparse" IS NOT NULL' : ''),
        },
      ]);
      assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
      assert.deepEqual(
        database
          .prepare(
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' ORDER BY name",
          )
          .all(),
        indexes,
      );
      assert.equal(JSON.stringify(plan), before);
    } finally {
      database.close();
    }
  });
}

describe('SQLite pending index creation', () => {
  const table = compileTable(
    defineGtfsTable({
      filename: null,
      tableName: 'index_fixture',
      specification: 'gtfs-schedule',
      presence: 'optional',
      keyStrategy: 'none',
      storageKey: null,
      fields: { sparse: { kind: 'text' }, dense: { kind: 'text' } },
      indexes: ['sparse', 'dense', ['dense', 'sparse']],
    }),
  );
  const plan = createGtfsStoragePlan({ dialect: 'sqlite', tables: [table] });
  let database: Database.Database;
  let statements: string[];

  beforeEach(() => {
    statements = [];
    database = new Database(':memory:', {
      verbose: (statement) => statements.push(String(statement)),
    });
    applySqliteGtfsTablePlan(database, plan);
    database.exec(`
      INSERT INTO index_fixture (source_id, sparse, dense)
      VALUES ('first', NULL, 'a'), ('other', 'b', 'c')
    `);
    statements.length = 0;
  });

  afterEach(() => {
    database.close();
  });

  test('counts rows and all pending single columns in one scan and creates indexes in one transaction', () => {
    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
    assert.deepEqual(
      statements.filter((statement) => statement.includes('COUNT(')),
      [
        'SELECT COUNT(*) AS rowCount, COUNT("sparse") AS "c0", COUNT("dense") AS "c1", COUNT("source_id") AS "c2" FROM "index_fixture"',
      ],
    );
    assert.deepEqual(
      statements.filter((statement) =>
        /^(BEGIN|COMMIT|CREATE INDEX|PRAGMA optimize)/.test(statement),
      ),
      [
        'BEGIN',
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_sparse" ON "index_fixture" ("sparse");',
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_dense" ON "index_fixture" ("dense");',
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_source_id" ON "index_fixture" ("source_id");',
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_dense_sparse" ON "index_fixture" ("dense", "sparse");',
        'COMMIT',
        'PRAGMA optimize',
      ],
    );
  });

  test('skips density scans and index creation when reimporting with existing indexes', () => {
    applySqliteGtfsIndexPlan(database, plan);
    database.exec("DELETE FROM index_fixture WHERE source_id = 'first'");
    database.exec(
      "INSERT INTO index_fixture (source_id, dense) VALUES ('first', 'updated')",
    );
    statements.length = 0;

    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
    assert.deepEqual(
      statements.filter((statement) =>
        /COUNT\(|CREATE INDEX|PRAGMA optimize/.test(statement),
      ),
      [],
    );
    assert.equal(
      database.prepare('SELECT COUNT(*) FROM index_fixture').pluck().get(),
      2,
    );
  });

  test('counts only missing single-column indexes and does not scan for missing composite indexes', () => {
    applySqliteGtfsIndexPlan(database, plan);
    database.exec('DROP INDEX idx_index_fixture_dense');
    statements.length = 0;

    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
    assert.deepEqual(
      statements.filter((statement) => /COUNT\(|CREATE INDEX/.test(statement)),
      [
        'SELECT COUNT(*) AS rowCount, COUNT("dense") AS "c0" FROM "index_fixture"',
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_dense" ON "index_fixture" ("dense");',
      ],
    );

    database.exec('DROP INDEX idx_index_fixture_dense_sparse');
    statements.length = 0;
    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
    assert.deepEqual(
      statements.filter((statement) => /COUNT\(|CREATE INDEX/.test(statement)),
      [
        'CREATE INDEX IF NOT EXISTS "idx_index_fixture_dense_sparse" ON "index_fixture" ("dense", "sparse");',
      ],
    );
  });

  test('reports incompatible existing indexes without scanning or replacing them', () => {
    applySqliteGtfsIndexPlan(database, plan);
    database.exec(`
      DROP INDEX idx_index_fixture_sparse;
      CREATE INDEX idx_index_fixture_sparse ON index_fixture (dense)
    `);
    statements.length = 0;

    const inspection = applySqliteGtfsIndexPlan(database, plan);
    assert.equal(inspection.compatible, false);
    assert.deepEqual(inspection.tableIssues[0]?.incompatibleIndexes, [
      'idx_index_fixture_sparse',
    ]);
    assert.deepEqual(
      statements.filter((statement) => /COUNT\(|CREATE INDEX/.test(statement)),
      [],
    );
  });

  test('rolls back pending indexes across tables on failure and preserves existing indexes', () => {
    database.exec('CREATE INDEX custom_index ON index_fixture (source_id)');
    const failingPlan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [table, { ...table, tableName: 'missing_table' }],
    });
    assert.throws(
      () => applySqliteGtfsIndexPlan(database, failingPlan),
      /no such table: missing_table/,
    );
    assert.deepEqual(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .pluck()
        .all(),
      ['custom_index'],
    );
    assert.equal(database.inTransaction, false);
    assert.equal(statements.includes('PRAGMA optimize'), false);
    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
  });

  test('does not commit a caller-owned transaction', () => {
    database.exec('BEGIN');
    assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
    assert.equal(database.inTransaction, true);
    assert.equal(
      statements.filter((statement) => statement === 'PRAGMA optimize').length,
      1,
    );
    database.exec('ROLLBACK');
    assert.deepEqual(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all(),
      [],
    );
  });

  test('validate mode reports missing indexes without counts, DDL, or transactions', () => {
    const inspection = applySqliteGtfsIndexPlan(database, {
      ...plan,
      mode: 'validate',
    });
    assert.equal(inspection.compatible, false);
    assert.deepEqual(inspection.tableIssues[0]?.missingIndexes, [
      'idx_index_fixture_sparse',
      'idx_index_fixture_dense',
      'idx_index_fixture_dense_sparse',
      'idx_index_fixture_source_id',
    ]);
    assert.deepEqual(
      statements.filter((statement) =>
        /COUNT\(|^(CREATE INDEX|BEGIN|COMMIT|PRAGMA optimize)/.test(statement),
      ),
      [],
    );
  });
});
