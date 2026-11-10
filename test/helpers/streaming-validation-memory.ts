// Runs in a heap-limited subprocess from streaming-validation.test.ts.
import assert from 'node:assert/strict';
import { open, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { GtfsValidationNoticeCode } from '../../src/diagnostics/errors.ts';

const directory = process.argv[2];
assert.ok(directory);
const filename = path.join(directory, 'stops.txt');
const file = await open(filename, 'w');
try {
  await file.write('stop_id,stop_desc,parent_station\n');
  const description = 'x'.repeat(2048);
  for (let offset = 0; offset < 50_000; offset += 100) {
    await file.write(
      Array.from(
        { length: 100 },
        (_, index) =>
          `${offset + index},${description},missing-${offset + index}-${description}\n`,
      ).join(''),
    );
  }
} finally {
  await file.close();
}
const stopTimesPath = path.join(directory, 'stop_times.txt');
await writeFile(
  stopTimesPath,
  'trip_id,stop_id,stop_sequence\ntrip,0,1\ntrip,49999,2\n',
);
let noticeCount = 0;
const staged = await stageGtfsSource({
  directory,
  tables: [compiledTableRegistry.stops, compiledTableRegistry.stopTimes],
  sourceId: 'large',
  mode: 'strict',
  onUnknownField: 'preserve',
  onDuplicateKey: 'keep-first',
  excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
  onNotice() {
    noticeCount += 1;
  },
});
try {
  assert.equal(staged.validation.valid, true);
  assert.equal(staged.validation.samples.length, 100);
  assert.equal(staged.validation.truncated, true);
  assert.equal(
    staged.validation.countsByCode[
      GtfsValidationNoticeCode.REFERENCE_NOT_FOUND
    ],
    50_000,
  );
  assert.equal(noticeCount, 50_000);
  staged.assertNormalized();
  await rm(filename);
  await rm(stopTimesPath);
  let count = 0;
  for (const batch of staged.batches(
    compiledTableRegistry.stops,
    100,
    50_000,
  )) {
    assert.ok(batch.records.length <= 100);
    for (const { row } of batch.records) {
      assert.equal(row.stop_id, String(count));
      assert.equal(row.parent_station, `missing-${count}-${'x'.repeat(2048)}`);
      assert.equal(String(row.stop_desc).length, 2048);
      count += 1;
    }
  }
  assert.equal(count, 50_000);
  process.stdout.write(`Validated and replayed ${count} records\n`);
} finally {
  await staged.close();
}
