// Runs in the heap-limited row-normalizer test to catch oversized wide-row layouts.
import assert from 'node:assert/strict';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';

const rows = Array.from({ length: 40_000 }, (_, index) =>
  normalizeGtfsRecord(
    {
      trip_id: 'trip',
      stop_sequence: index,
      stop_id: 'stop',
      arrival_time: index % 2 === 0 ? '25:01:02' : '',
    },
    compiledTableRegistry.stopTimes,
    {
      sourceId: String(index),
      position: {
        kind: 'csv',
        recordNumber: index + 1,
        csvLineNumber: index + 2,
      },
      onUnknownField: 'preserve',
    },
  ),
);
for (const [index, row] of rows.entries()) {
  assert.equal(row.source_id, String(index));
  assert.equal(row.stop_sequence, index);
  assert.equal(row.arrival_time, index % 2 === 0 ? '25:01:02' : null);
  assert.equal(row.arrival_service_day_seconds, index % 2 === 0 ? 90062 : null);
  assert.equal(row.departure_time, null);
  assert.equal(row._unknown_fields, null);
  assert.ok(Object.isFrozen(row));
}
process.stdout.write('Normalized 40000 wide records\n');
