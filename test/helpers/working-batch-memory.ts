// Replays a wide working batch in the heap-limited validation-storage test subprocess.
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createGtfsWorkingBatches } from '../../src/schedule/import/staging/batches.ts';

const database = new Database(':memory:');
try {
  const batches = createGtfsWorkingBatches(database, 'records');
  const fields = Object.fromEntries(
    Array.from({ length: 36 }, (_, index) => [`field_${index}`, null]),
  );
  for (let index = 0; index < 40_000; index += 1) {
    batches.append('wide.txt', index + 1, {
      row: { ...fields, id: String(index), amount: BigInt(index) },
      position: {
        kind: 'csv',
        recordNumber: index + 1,
        csvLineNumber: index + 2,
      },
    });
  }
  const records = [...batches.records('wide.txt')];
  assert.equal(records.length, 40_000);
  for (const [index, record] of records.entries()) {
    assert.equal(record.row.id, String(index));
    assert.equal(record.row.amount, BigInt(index));
    assert.equal(record.row.field_35, null);
    assert.deepEqual(record.position, {
      kind: 'csv',
      recordNumber: index + 1,
      csvLineNumber: index + 2,
    });
  }
  process.stdout.write('Replayed 40000 wide records\n');
} finally {
  database.close();
}
