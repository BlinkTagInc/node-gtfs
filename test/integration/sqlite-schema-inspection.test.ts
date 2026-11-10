import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import {
  applySqliteGtfsTablePlan,
  applySqliteGtfsIndexPlan,
} from '../../src/database/sqlite/schema-writer.ts';
import { inspectSqliteGtfsStoragePlan } from '../../src/database/sqlite/schema-inspector.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import {
  normalizeSqlExpression,
  sqliteServiceTimeExpression,
  readSqliteGeneratedExpression,
} from '../../src/database/sqlite/expressions.ts';

for (const { predicate, compatible } of [
  { predicate: '"to_stop_id" IS NOT NULL', compatible: true },
  { predicate: '"to_stop_id" IS NULL', compatible: false },
  { predicate: '"to_stop_id" = \'only-this-stop\'', compatible: false },
]) {
  test(`SQLite index inspection checks the predicate: ${predicate}`, () => {
    const database = new Database(':memory:');
    const plan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.transfers],
    });
    try {
      applySqliteGtfsTablePlan(database, plan);
      applySqliteGtfsIndexPlan(database, plan);
      database.exec(`DROP INDEX idx_transfers_to_stop_id;
        CREATE INDEX idx_transfers_to_stop_id ON transfers ("to_stop_id") WHERE ${predicate}`);
      const inspection = inspectSqliteGtfsStoragePlan(database, plan, {
        includeIndexes: true,
      });
      assert.equal(inspection.compatible, compatible);
      assert.deepEqual(
        inspection.tableIssues.flatMap(
          (issue) => issue.incompatibleIndexes ?? [],
        ),
        compatible ? [] : ['idx_transfers_to_stop_id'],
      );
      assert.equal(
        inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: false })
          .compatible,
        true,
      );
    } finally {
      database.close();
    }
  });
}

test('SQLite inspection checks canonical storage keys even when ordinary indexes are excluded', () => {
  const database = new Database(':memory:');
  const plan = createGtfsStoragePlan({
    dialect: 'sqlite',
    tables: [compiledTableRegistry.transfers],
  });
  try {
    applySqliteGtfsTablePlan(database, plan);
    assert.equal(
      inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: false })
        .compatible,
      true,
    );
    const table = database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transfers'",
      )
      .get() as { sql: string } | undefined;
    assert.ok(table);
    const withoutKey = table.sql.replace(', UNIQUE ("_node_gtfs_key")', '');
    assert.notEqual(withoutKey, table.sql);
    database.exec('DROP TABLE transfers');
    database.exec(withoutKey);
    const inspection = inspectSqliteGtfsStoragePlan(database, plan, {
      includeIndexes: false,
    });
    assert.equal(inspection.compatible, false);
    assert.equal(inspection.tableIssues[0]?.incompatibleStorageKey, true);
    assert.deepEqual(inspection.tableIssues[0]?.missingIndexes, []);
  } finally {
    database.close();
  }
});

test('SQLite inspection rejects reordered columns in a named composite index', () => {
  const database = new Database(':memory:');
  const tables = [compiledTableRegistry.stops];
  try {
    const plan = createGtfsStoragePlan({ dialect: 'sqlite', tables });
    applySqliteGtfsTablePlan(database, plan);
    applySqliteGtfsIndexPlan(database, plan);
    assert.equal(
      inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: true })
        .compatible,
      true,
    );
    database.exec(`DROP INDEX idx_stops_source_id_stop_lat_stop_lon;
      CREATE INDEX idx_stops_source_id_stop_lat_stop_lon ON stops (stop_lat, source_id, stop_lon)`);
    const inspection = inspectSqliteGtfsStoragePlan(database, plan, {
      includeIndexes: true,
    });
    assert.equal(inspection.compatible, false);
    assert.deepEqual(inspection.tableIssues[0]?.incompatibleIndexes, [
      'idx_stops_source_id_stop_lat_stop_lon',
    ]);
  } finally {
    database.close();
  }
});

test('generated-expression parsing preserves nested parentheses and escaped string literals', () => {
  const expression = `coalesce(substr("arrival_time", 1, 2), 'It''s (OK)')`;
  assert.equal(
    readSqliteGeneratedExpression(
      `CREATE TABLE example ("seconds" INTEGER GENERATED ALWAYS AS (${expression}) STORED)`,
      'seconds',
    ),
    expression,
  );
  assert.equal(
    readSqliteGeneratedExpression(
      'CREATE TABLE example ("seconds" INTEGER)',
      'seconds',
    ),
    null,
  );
  assert.equal(
    readSqliteGeneratedExpression(
      '"seconds" INTEGER GENERATED ALWAYS AS (coalesce(',
      'seconds',
    ),
    null,
  );
  assert.equal(
    normalizeSqlExpression("COALESCE( 'Keep Case', 0 )"),
    normalizeSqlExpression("coalesce('Keep Case',0)"),
  );
  assert.notEqual(
    normalizeSqlExpression("'Keep Case'"),
    normalizeSqlExpression("'keep case'"),
  );
});

for (const { kind, expression, compatible } of [
  {
    kind: 'STORED',
    expression: sqliteServiceTimeExpression('arrival_time'),
    compatible: true,
  },
  {
    kind: 'VIRTUAL',
    expression: sqliteServiceTimeExpression('arrival_time'),
    compatible: true,
  },
  { kind: 'STORED', expression: '0', compatible: false },
  { kind: 'VIRTUAL', expression: '0', compatible: false },
  { kind: 'ordinary', expression: '', compatible: false },
]) {
  test(`SQLite inspection checks ${kind} service-time columns without modifying schema`, () => {
    const database = new Database(':memory:');
    try {
      const plan = createGtfsStoragePlan({
        dialect: 'sqlite',
        tables: [compiledTableRegistry.stopTimes],
      });
      applySqliteGtfsTablePlan(database, plan);
      const original = database
        .prepare("SELECT sql FROM sqlite_master WHERE name = 'stop_times'")
        .pluck()
        .get() as string;
      const definition = `"arrival_service_day_seconds" INTEGER GENERATED ALWAYS AS (${sqliteServiceTimeExpression('arrival_time')}) STORED`;
      assert.ok(original.includes(definition));
      const replacement =
        kind === 'ordinary'
          ? '"arrival_service_day_seconds" INTEGER'
          : `"arrival_service_day_seconds" INTEGER GENERATED ALWAYS AS (${expression}) ${kind}`;
      database.exec('DROP TABLE stop_times');
      database.exec(original.replace(definition, replacement));
      const before = database
        .prepare('SELECT * FROM sqlite_master ORDER BY name')
        .all();
      database.pragma('query_only = ON');
      const inspection = inspectSqliteGtfsStoragePlan(database, plan, {
        includeIndexes: false,
      });
      assert.equal(inspection.compatible, compatible);
      assert.deepEqual(
        inspection.tableIssues.flatMap(
          (issue) => issue.incompatibleGeneratedColumns,
        ),
        compatible ? [] : ['arrival_service_day_seconds'],
      );
      assert.deepEqual(
        database.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),
        before,
      );
    } finally {
      database.close();
    }
  });
}

test('compatible table ensure avoids writes while index ensure still repairs missing indexes', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const plan = createGtfsStoragePlan({
    dialect: 'sqlite',
    mode: 'ensure',
    tables: [compiledTableRegistry.stops],
  });
  applySqliteGtfsTablePlan(database, plan);
  const before = database
    .prepare('SELECT * FROM sqlite_master ORDER BY name')
    .all();
  const transaction = t.mock.method(database, 'transaction', () => {
    throw new Error(
      'Compatible table ensure must not start a write transaction',
    );
  });
  database.pragma('query_only = ON');
  assert.equal(applySqliteGtfsTablePlan(database, plan).compatible, true);
  assert.deepEqual(
    database.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),
    before,
  );
  transaction.mock.restore();
  database.pragma('query_only = OFF');
  assert.equal(
    inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: true })
      .compatible,
    false,
  );
  assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, true);
  database.exec(
    'DROP INDEX idx_stops_source_id_stop_lat_stop_lon; CREATE INDEX idx_stops_source_id_stop_lat_stop_lon ON stops (stop_lat)',
  );
  assert.equal(applySqliteGtfsTablePlan(database, plan).compatible, true);
  assert.equal(applySqliteGtfsIndexPlan(database, plan).compatible, false);
});

test('table ensure still creates missing tables alongside compatible existing tables', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const plan = createGtfsStoragePlan({
    dialect: 'sqlite',
    mode: 'ensure',
    tables: [compiledTableRegistry.stops, compiledTableRegistry.stopTimes],
  });
  applySqliteGtfsTablePlan(database, plan);
  database.exec('DROP TABLE stop_times');
  assert.equal(
    inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: false })
      .compatible,
    false,
  );
  assert.equal(applySqliteGtfsTablePlan(database, plan).compatible, true);
});
