import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { createGtfsStorageValuesProjector } from '../../src/database/storage/row-projection.ts';
import { createSqliteGtfsWriter } from '../../src/database/sqlite/schedule-writer.ts';
import { applySqliteGtfsTablePlan } from '../../src/database/sqlite/schema-writer.ts';
import type { NormalizedImportRow } from '../../src/values/normalize-row.ts';
import { GtfsError, GtfsErrorCode } from '../../src/diagnostics/errors.ts';

const table = compileTable(
  defineGtfsTable({
    filename: 'bindings.txt',
    tableName: 'bindings',
    specification: 'gtfs-schedule',
    presence: 'optional',
    primaryKey: ['id'],
    keyStrategy: 'canonical',
    fields: {
      id: { kind: 'id' },
      required_value: { kind: 'integer', presence: 'required' },
      optional_value: { kind: 'integer', defaultValue: 7 },
      name: { kind: 'text', supportsCaseInsensitiveComparison: true },
      arrival_time: { kind: 'time' },
      currency: { kind: 'text' },
      amount: {
        kind: 'real',
        monetary: {
          currencyField: 'currency',
          publicRepresentation: 'decimal-string',
          storageRepresentation: 'minor-units',
        },
      },
    },
  }),
);

function fixture(t: TestContext) {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const storagePlan = createGtfsStoragePlan({
    dialect: 'sqlite',
    tables: [table],
  });
  applySqliteGtfsTablePlan(database, storagePlan);
  const statements: string[] = [];
  const prepare = database.prepare.bind(database);
  t.mock.method(database, 'prepare', (sql: string) => {
    statements.push(sql);
    return prepare(sql);
  });
  const writer = createSqliteGtfsWriter({
    database,
    databasePath: ':memory:',
    table,
    storagePlan,
    filename: 'bindings.txt',
    sourceId: 'first',
    onDuplicateKey: 'reject',
    reporting: { level: 'silent' },
  });
  const write = (rows: readonly NormalizedImportRow[], firstRecordNumber = 1) =>
    writer.writeBatch({
      table,
      totalRecordCount: firstRecordNumber + rows.length - 1,
      records: rows.map((row, index) => ({
        row: Object.freeze({ source_id: 'first', required_value: 0, ...row }),
        position: {
          kind: 'csv',
          recordNumber: firstRecordNumber + index,
          csvLineNumber: firstRecordNumber + index + 10,
        },
      })),
    });
  return { database, storagePlan, statements, write };
}

test('SQLite sparse bindings match full-column inserts across changing batch shapes', async (t) => {
  const { database, storagePlan, statements, write } = fixture(t);
  const expected = new Database(':memory:');
  t.after(() => expected.close());
  applySqliteGtfsTablePlan(expected, storagePlan);
  const tablePlan = storagePlan.tables[0];
  assert.ok(tablePlan);
  const columns = tablePlan.columns.filter(
    ({ role }) => role !== 'service-time',
  );
  const project = createGtfsStorageValuesProjector(tablePlan, columns);
  const insert = expected.prepare(
    `INSERT INTO bindings (${columns.map(({ name }) => `"${name}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
  );
  const batches: readonly (readonly NormalizedImportRow[])[] = [
    [{ id: null, name: null, optional_value: null }],
    [
      { id: 'one' },
      {
        id: 'two',
        name: 'Straße Transit',
        optional_value: 0,
        arrival_time: '25:01:02',
        currency: 'USD',
        amount: 12345n,
        _unknown_fields: '{"extra":"✓"}',
      },
    ],
    [
      {
        source_id: 'second',
        id: 'two',
        name: '',
        arrival_time: '00:00:00',
        optional_value: null,
      },
    ],
    [{ id: 'three' }],
    [],
  ];
  for (const rows of batches) {
    await write(rows);
    for (const row of rows) {
      insert.run(project({ source_id: 'first', required_value: 0, ...row }));
    }
  }
  assert.deepEqual(
    database.prepare('SELECT * FROM bindings ORDER BY source_id, id').all(),
    expected.prepare('SELECT * FROM bindings ORDER BY source_id, id').all(),
  );
  assert.equal(
    database
      .prepare('SELECT optional_value FROM bindings WHERE id IS NULL')
      .pluck()
      .get(),
    null,
  );
  assert.equal(
    database
      .prepare(
        'SELECT arrival_service_day_seconds FROM bindings WHERE source_id = ? AND id = ?',
      )
      .pluck()
      .get('first', 'two'),
    90062,
  );
  const inserts = statements.filter((sql) => sql.startsWith('INSERT INTO'));
  assert.ok(inserts.some((sql) => sql.includes('NULL')));
  assert.ok(
    inserts.some((sql) => (sql.match(/\?/g)?.length ?? 0) < columns.length),
  );
});

test('SQLite prepares inserts per batch shape rather than per row', async (t) => {
  const { database, statements, write } = fixture(t);
  await write(
    Array.from({ length: 2000 }, (_, index) => ({
      id: `row-${index}`,
      name: 'Transit',
    })),
  );
  assert.equal(
    database.prepare('SELECT count(*) FROM bindings').pluck().get(),
    2000,
  );
  assert.equal(
    statements.filter((sql) => sql.startsWith('INSERT INTO')).length,
    2,
  );
});

test('SQLite sparse bindings preserve failing record positions, rollback, and writer reuse', async (t) => {
  const { database, write } = fixture(t);
  await write([{ id: 'existing' }]);
  await assert.rejects(
    async () =>
      write(
        [{ id: 'rolled-back' }, { id: 'invalid', required_value: null }],
        501,
      ),
    (error: unknown) => {
      assert.ok(error instanceof GtfsError);
      assert.equal(error.code, GtfsErrorCode.DATABASE_OPERATION_FAILED);
      assert.deepEqual(error.position, {
        kind: 'csv',
        recordNumber: 502,
        csvLineNumber: 512,
      });
      return true;
    },
  );
  assert.deepEqual(database.prepare('SELECT id FROM bindings').pluck().all(), [
    'existing',
  ]);
  await assert.rejects(
    async () => write([{ id: 'all-null-required', required_value: null }], 701),
    (error: unknown) => {
      assert.ok(error instanceof GtfsError);
      assert.deepEqual(error.position, {
        kind: 'csv',
        recordNumber: 701,
        csvLineNumber: 711,
      });
      return true;
    },
  );
  await write([{ id: 'recovered', name: 'Recovered' }]);
  assert.deepEqual(
    database.prepare('SELECT id FROM bindings ORDER BY id').pluck().all(),
    ['existing', 'recovered'],
  );
});
