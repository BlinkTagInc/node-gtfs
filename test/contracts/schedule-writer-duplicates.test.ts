import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import pg from 'pg';
import mysql from 'mysql2';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { applySqliteGtfsTablePlan } from '../../src/database/sqlite/schema-writer.ts';
import { applyKyselyGtfsTablePlan } from '../../src/database/kysely/schema-writer.ts';
import { createSqliteGtfsWriter } from '../../src/database/sqlite/schedule-writer.ts';
import { createKyselyGtfsWriter } from '../../src/database/kysely/schedule-writer.ts';
import { createGtfsImportResult } from '../../src/schedule/import/result.ts';
import type { NormalizedImportRecord } from '../../src/schedule/import/records.ts';
import type { GtfsDatabaseDialect } from '../../src/database/dialects.ts';
import { insertMysqlRowsKeepingFirst } from '../../src/database/kysely/insert-keeping-first.ts';
import { isGtfsError } from '../../src/diagnostics/errors.ts';

const duplicateWriterTable = compileTable(
  defineGtfsTable({
    filename: 'writer_duplicates.txt',
    tableName: 'writer_duplicates',
    specification: 'gtfs-schedule',
    presence: 'optional',
    primaryKey: ['id'],
    keyStrategy: 'canonical',
    fields: {
      id: { kind: 'id' },
      value: { kind: 'integer', presence: 'required', minimum: 0 },
    },
  }),
);

function record(
  id: string | null,
  value: number | null,
  sourceId = 'source',
): NormalizedImportRecord {
  return {
    row: { source_id: sourceId, id, value },
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
  };
}

const postgresUrl = process.env.GTFS_TEST_POSTGRES_URL;
const mysqlUrl = process.env.GTFS_TEST_MYSQL_URL;
for (const adapter of [
  'native',
  'sqlite',
  'postgres',
  'mysql',
  'mysql-no-found-rows',
] as const) {
  test(
    `${adapter} writer keeps first rows and counts duplicates without retaining file keys`,
    {
      skip:
        adapter === 'postgres'
          ? postgresUrl === undefined
          : adapter.startsWith('mysql')
            ? mysqlUrl === undefined
            : false,
      timeout: 30_000,
    },
    async (t) => {
      const dialect: GtfsDatabaseDialect =
        adapter === 'native'
          ? 'sqlite'
          : adapter === 'mysql-no-found-rows'
            ? 'mysql'
            : adapter;
      const native =
        dialect === 'sqlite' ? new Database(':memory:') : undefined;
      const database = new Kysely<Record<string, Record<string, unknown>>>({
        dialect:
          native !== undefined
            ? new SqliteDialect({ database: native })
            : dialect === 'postgres'
              ? new PostgresDialect({
                  pool: new pg.Pool({ connectionString: postgresUrl }),
                })
              : new MysqlDialect({
                  pool: mysql.createPool({
                    uri: mysqlUrl ?? '',
                    ...(adapter === 'mysql-no-found-rows'
                      ? { flags: ['-FOUND_ROWS'] }
                      : {}),
                  }),
                }),
      });
      t.after(async () => {
        try {
          await database.schema
            .dropTable(duplicateWriterTable.tableName)
            .ifExists()
            .execute();
        } finally {
          await database.destroy();
        }
      });
      const storagePlan = createGtfsStoragePlan({
        dialect,
        mode: 'recreate',
        tables: [duplicateWriterTable],
      });
      if (adapter === 'native' && native !== undefined) {
        applySqliteGtfsTablePlan(native, storagePlan);
      } else {
        await applyKyselyGtfsTablePlan(database, storagePlan);
      }
      const result = createGtfsImportResult();
      const createWriter = (
        onDuplicateKey: 'keep-first' | 'reject' = 'keep-first',
      ) => {
        const options = {
          table: duplicateWriterTable,
          filename: 'writer_duplicates.txt',
          sourceId: 'source',
          onDuplicateKey,
          reporting: { level: 'silent' as const },
          storagePlan,
          result,
        };
        return adapter === 'native' && native !== undefined
          ? createSqliteGtfsWriter({
              ...options,
              database: native,
              databasePath: ':memory:',
            })
          : createKyselyGtfsWriter({ ...options, database });
      };
      const writer = createWriter();
      const batch = (records: readonly NormalizedImportRecord[]) => ({
        table: duplicateWriterTable,
        records,
        totalRecordCount: records.length,
      });
      assert.deepEqual(await writer.writeBatch(batch([])), {
        rowsInserted: 0,
        rowsSkipped: 0,
      });
      assert.deepEqual(
        await writer.writeBatch(
          batch([
            record('one', 1),
            record('one', 99),
            record(null, 2),
            record(null, 99),
          ]),
        ),
        { rowsInserted: 2, rowsSkipped: 2 },
      );
      assert.deepEqual(
        await writer.writeBatch(
          batch([record('one', 99), record('two', 3), record(null, 99)]),
        ),
        { rowsInserted: 1, rowsSkipped: 2 },
      );
      assert.deepEqual(
        await createWriter().writeBatch(
          batch([
            record('two', 99),
            record('one', 4, 'other'),
            record(null, 5, 'other'),
          ]),
        ),
        { rowsInserted: 2, rowsSkipped: 1 },
      );
      assert.deepEqual(
        result.validation.samples.map(({ details }) => details?.skippedRows),
        [2, 2, 1],
      );
      for (const notice of result.validation.samples) {
        assert.equal(notice.code, 'GTFS_DUPLICATE_PRIMARY_KEY');
        assert.equal(notice.severity, 'warn');
        assert.equal(notice.filename, 'writer_duplicates.txt');
        assert.equal(notice.sourceId, 'source');
        assert.equal(notice.details?.scope, 'database');
      }
      const rows = await database
        .selectFrom('writer_duplicates')
        .select(['source_id', 'id', 'value'])
        .execute();
      assert.deepEqual(
        rows.map((row) => [row.source_id, row.id, Number(row.value)]).sort(),
        [
          ['source', 'one', 1],
          ['source', null, 2],
          ['source', 'two', 3],
          ['other', 'one', 4],
          ['other', null, 5],
        ].sort(),
      );

      // A failed insert must not leave keys remembered by a reused writer.
      await assert.rejects(
        async () =>
          writer.writeBatch(
            batch([record('retry', 6), record('invalid', null)]),
          ),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
          assert.equal(error.category, 'database');
          assert.equal(error.details?.sourceId, 'source');
          assert.equal(error.details?.table, 'writer_duplicates');
          assert.equal(error.details?.filename, 'writer_duplicates.txt');
          assert.equal(error.details?.databaseDialect, dialect);
          assert.equal(typeof error.details?.databaseCode, 'string');
          assert.ok(error.cause);
          assert.equal(error.details?.sql, undefined);
          if (adapter === 'native') {
            assert.deepEqual(error.position, record('invalid', null).position);
          } else {
            assert.deepEqual(error.positions, [
              record('retry', 6).position,
              record('invalid', null).position,
            ]);
          }
          return true;
        },
      );
      assert.equal(
        (
          await database
            .selectFrom('writer_duplicates')
            .select('id')
            .where('id', '=', 'retry')
            .execute()
        ).length,
        0,
      );
      await writer.writeBatch(batch([record('retry', 7)]));
      assert.equal(
        Number(
          (
            await database
              .selectFrom('writer_duplicates')
              .select('value')
              .where('id', '=', 'retry')
              .executeTakeFirstOrThrow()
          ).value,
        ),
        7,
      );
      await assert.rejects(
        async () => writer.writeBatch(batch([record('negative', -1)])),
        { code: 'GTFS_DATABASE_OPERATION_FAILED' },
      );
      await assert.rejects(
        async () =>
          createWriter('reject').writeBatch(batch([record('one', 99)])),
        { code: 'GTFS_DATABASE_OPERATION_FAILED' },
      );
      assert.equal(result.validation.samples.length, 3);
      if (adapter !== 'native') {
        const failure = new Error('Abort after duplicate fallback');
        await assert.rejects(
          database.transaction().execute(async (transaction) => {
            const transactionWriter = createKyselyGtfsWriter({
              database: transaction,
              table: duplicateWriterTable,
              filename: 'writer_duplicates.txt',
              sourceId: 'source',
              onDuplicateKey: 'keep-first',
              reporting: { level: 'silent' },
              storagePlan,
            });
            await transactionWriter.writeBatch(
              batch([
                record('one', 99),
                record('rolled-back', 8),
                record('two', 99),
              ]),
            );
            throw failure;
          }),
          (error) => error === failure,
        );
        assert.equal(
          (
            await database
              .selectFrom('writer_duplicates')
              .select('id')
              .where('id', '=', 'rolled-back')
              .execute()
          ).length,
          0,
        );
        assert.equal(
          Number(
            (
              await database
                .selectFrom('writer_duplicates')
                .select('value')
                .where('id', '=', 'one')
                .where('source_id', '=', 'source')
                .executeTakeFirstOrThrow()
            ).value,
          ),
          1,
        );
      }
    },
  );
}

test('MySQL duplicate fallback keeps bulk inserts fast and propagates unrelated failures', async () => {
  let calls = 0;
  const insert = async () => {
    calls += 1;
  };
  assert.equal(await insertMysqlRowsKeepingFirst({ rows: [], insert }), 0);
  assert.equal(calls, 0);
  assert.equal(
    await insertMysqlRowsKeepingFirst({ rows: [{ id: 1 }, { id: 2 }], insert }),
    0,
  );
  assert.equal(calls, 1);
  for (const error of [
    new Error('offline'),
    { code: 'ER_LOCK_DEADLOCK' },
    { code: 'ER_BAD_NULL_ERROR' },
    null,
  ]) {
    calls = 0;
    await assert.rejects(
      async () =>
        insertMysqlRowsKeepingFirst({
          rows: [{ id: 1 }, { id: 2 }],
          insert: async () => {
            calls += 1;
            throw error;
          },
        }),
      (actual) => actual === error,
    );
    assert.equal(calls, 1);
  }
});

test('MySQL duplicate fallback splits failed statements in source order and counts every skipped row', async () => {
  const stored = new Map<unknown, unknown>([['existing', 0]]);
  const values = [
    { id: 'one', value: 1 },
    { id: 'existing', value: 99 },
    { id: 'one', value: 99 },
    { id: 'two', value: 2 },
    { id: 'two', value: 99 },
    { id: 'three', value: 3 },
  ];
  const insert = async (rows: readonly Record<string, unknown>[]) => {
    const statementKeys = new Set<unknown>();
    for (const row of rows) {
      if (stored.has(row.id) || statementKeys.has(row.id)) {
        throw Object.assign(new Error('Duplicate entry'), {
          code: 'ER_DUP_ENTRY',
        });
      }
      statementKeys.add(row.id);
    }
    for (const row of rows) {
      stored.set(row.id, row.value);
    }
  };
  assert.equal(await insertMysqlRowsKeepingFirst({ rows: values, insert }), 3);
  assert.deepEqual(
    [...stored],
    [
      ['existing', 0],
      ['one', 1],
      ['two', 2],
      ['three', 3],
    ],
  );
  assert.equal(await insertMysqlRowsKeepingFirst({ rows: values, insert }), 6);
});
