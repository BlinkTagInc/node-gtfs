// Runs in a heap-limited subprocess from schedule-writer-memory.test.ts.
import assert from 'node:assert/strict';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { applySqliteGtfsTablePlan } from '../../src/database/sqlite/schema-writer.ts';
import { applyKyselyGtfsTablePlan } from '../../src/database/kysely/schema-writer.ts';
import { createSqliteGtfsWriter } from '../../src/database/sqlite/schedule-writer.ts';
import { createKyselyGtfsWriter } from '../../src/database/kysely/schedule-writer.ts';
import { createGtfsImportResult } from '../../src/schedule/import/result.ts';

const [directory, adapter] = process.argv.slice(2);
assert.ok(directory);
assert.ok(adapter === 'native' || adapter === 'kysely');
const databasePath = path.join(directory, 'duplicates.sqlite');
const native = new Database(databasePath);
const database = new Kysely({
  dialect: new SqliteDialect({ database: native }),
});
try {
  native.exec(
    'PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-2048',
  );
  const table = compiledTableRegistry.stopTimes;
  const storagePlan = createGtfsStoragePlan({
    dialect: 'sqlite',
    tables: [table],
  });
  if (adapter === 'native') {
    applySqliteGtfsTablePlan(native, storagePlan);
  } else {
    await applyKyselyGtfsTablePlan(database, storagePlan);
  }
  const result = createGtfsImportResult();
  const options = {
    table,
    filename: table.filename,
    sourceId: 'large',
    onDuplicateKey: 'keep-first' as const,
    storagePlan,
    reporting: { level: 'silent' as const },
    result,
  };
  const writer =
    adapter === 'native'
      ? createSqliteGtfsWriter({
          ...options,
          database: native,
          databasePath,
        })
      : createKyselyGtfsWriter({ ...options, database });
  const tripId = 'trip-'.padEnd(256, 'x');
  for (let offset = 0; offset < 200_000; offset += 500) {
    await writer.writeBatch({
      table,
      totalRecordCount: offset + 500,
      records: Array.from({ length: 500 }, (_, index) => ({
        row: {
          source_id: 'large',
          trip_id: tripId,
          stop_sequence: offset + index,
          stop_id: 'first',
        },
        position: {
          kind: 'csv' as const,
          recordNumber: offset + index + 1,
          csvLineNumber: offset + index + 2,
        },
      })),
    });
  }
  await writer.writeBatch({
    table,
    totalRecordCount: 200_001,
    records: [
      {
        row: {
          source_id: 'large',
          trip_id: tripId,
          stop_sequence: 0,
          stop_id: 'duplicate',
        },
        position: {
          kind: 'csv',
          recordNumber: 200_001,
          csvLineNumber: 200_002,
        },
      },
    ],
  });
  assert.equal(
    native.prepare('SELECT count(*) FROM stop_times').pluck().get(),
    200_000,
  );
  assert.equal(
    native
      .prepare('SELECT stop_id FROM stop_times WHERE stop_sequence = 0')
      .pluck()
      .get(),
    'first',
  );
  assert.deepEqual(
    result.validation.samples.map((notice) => notice.details?.skippedRows),
    [1],
  );
  process.stdout.write(`Stored 200000 records with ${adapter}\n`);
} finally {
  await database.destroy();
}
