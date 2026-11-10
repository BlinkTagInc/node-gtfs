import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserialize, serialize } from 'node:v8';

import {
  appendGtfsWorkingPosition,
  decodeGtfsWorkingBatch,
  encodeGtfsWorkingBatch,
  estimateGtfsWorkingRecordBytes,
} from '../../src/schedule/import/staging/codec.ts';
import type { NormalizedImportRecord } from '../../src/schedule/import/records.ts';
import type { GtfsSourcePosition } from '../../src/diagnostics/position.ts';

function encodeRecords(records: readonly NormalizedImportRecord[]): Buffer {
  const first = records[0];
  assert.ok(first);
  const encodedPositions: number[] = [];
  for (const record of records) {
    appendGtfsWorkingPosition(encodedPositions, record.position);
  }
  return encodeGtfsWorkingBatch({
    rowFields: Object.keys(first.row),
    rowValues: records.flatMap(({ row }) => Object.values(row)),
    positionKind: first.position.kind,
    encodedPositions,
  });
}

test('compact chunks avoid repeating field names and preserve exact values through serialization', () => {
  const fields = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => [
      `long_schedule_field_name_${index}`,
      null,
    ]),
  );
  const records: NormalizedImportRecord[] = Array.from(
    { length: 1000 },
    (_, index) => ({
      row: { ...fields, id: String(index), amount: BigInt(index) },
      position: {
        kind: 'csv',
        recordNumber: index + 1,
        csvLineNumber: index * 2 + 3,
      },
    }),
  );
  const payload = encodeRecords(records);
  assert.ok(payload.byteLength < serialize(records).byteLength / 2);
  assert.deepEqual([...decodeGtfsWorkingBatch(payload)], records);
});

test('constant-only working chunks preserve every position and independent rows', () => {
  const row = Object.fromEntries([
    ['source_id', 'same-source'],
    ['optional', null],
    ['__proto__', 'ordinary data'],
    ['constructor', 'ordinary data'],
    ['amount', 9223372036854775807n],
  ]);
  const records = Array.from({ length: 1025 }, (_, index) => ({
    row,
    position: {
      kind: 'csv' as const,
      recordNumber: index * 2 + 1,
      csvLineNumber: index * 3 + 2,
    },
  }));
  const payload = encodeRecords(records);
  const stored = deserialize(payload);
  assert.deepEqual(stored, {
    rowTemplate: row,
    varyingFields: [],
    varyingValues: [],
    positionKind: 'csv',
    encodedPositions: records.flatMap(({ position }) => [
      position.recordNumber,
      position.csvLineNumber,
    ]),
  });
  const replayed = [...decodeGtfsWorkingBatch(payload)];
  assert.deepEqual(replayed, records);
  const first = replayed[0];
  const second = replayed[1];
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.row, second.row);
  assert.equal(Object.getPrototypeOf(first.row), Object.prototype);
  assert.equal(Object.hasOwn(first.row, '__proto__'), true);
  (first.row as Record<string, unknown>).__proto__ = 'changed';
  assert.deepEqual(second.row, row);
  assert.deepEqual([...decodeGtfsWorkingBatch(payload)], records);
});

test('working templates retain late changes, signed zero, and scalar type differences', () => {
  const records: NormalizedImportRecord[] = Array.from(
    { length: 1024 },
    (_, index) => ({
      row: Object.fromEntries([
        ['source_id', 'same-source'],
        ['optional', index === 1023 ? 'last value' : null],
        ['zero', index === 1023 ? 0 : -0],
        ['typed', index === 1023 ? 0n : 0],
        [
          '__proto__',
          index === 1023 ? 'last proto value' : 'first proto value',
        ],
        ['constructor', 'data'],
      ]),
      position: { kind: 'geojson', featureNumber: index + 1 },
    }),
  );
  const payload = encodeRecords(records);
  const replayed = [...decodeGtfsWorkingBatch(payload)];
  assert.deepEqual(replayed, records);
  assert.ok(Object.is(replayed[0]?.row.zero, -0));
  assert.ok(Object.is(replayed[1023]?.row.zero, 0));
  assert.equal(replayed[0]?.row.typed, 0);
  assert.equal(replayed[1023]?.row.typed, 0n);
  for (const record of replayed) {
    assert.equal(Object.getPrototypeOf(record.row), Object.prototype);
    assert.equal(Object.hasOwn(record.row, '__proto__'), true);
  }
  assert.deepEqual([...decodeGtfsWorkingBatch(payload)], records);
});

test('working chunks preserve fully varying columns without a constant-value assumption', () => {
  const records: NormalizedImportRecord[] = [
    {
      row: { trip_id: 'one', stop_id: 'first' },
      position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    },
    {
      row: { trip_id: 'two', stop_id: 'last' },
      position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
    },
  ];
  const payload = encodeRecords(records);
  assert.deepEqual(deserialize(payload), {
    rowTemplate: { trip_id: null, stop_id: null },
    varyingFields: ['trip_id', 'stop_id'],
    varyingValues: ['one', 'first', 'two', 'last'],
    positionKind: 'csv',
    encodedPositions: [1, 2, 2, 3],
  });
  assert.deepEqual([...decodeGtfsWorkingBatch(payload)], records);
});

test('batch codec preserves empty rows and every position kind', () => {
  const positionGroups: readonly (readonly GtfsSourcePosition[])[] = [
    [
      { kind: 'csv', recordNumber: 3, csvLineNumber: 9 },
      { kind: 'csv', recordNumber: 7, csvLineNumber: 15 },
    ],
    [
      { kind: 'geojson', featureNumber: 21 },
      { kind: 'geojson', featureNumber: 40 },
    ],
    [
      { kind: 'realtime', entityNumber: 35 },
      { kind: 'realtime', entityNumber: 50 },
    ],
  ];
  for (const positions of positionGroups) {
    const records = positions.map((position) => ({ row: {}, position }));
    const payload = encodeRecords(records);
    assert.deepEqual([...decodeGtfsWorkingBatch(payload)], records);
  }
});

test('batch codec supports an empty batch', () => {
  const payload = encodeGtfsWorkingBatch({
    rowFields: [],
    rowValues: [],
    positionKind: 'csv',
    encodedPositions: [],
  });
  assert.deepEqual([...decodeGtfsWorkingBatch(payload)], []);
});

test('working record estimates include row overhead, scalar slots, and string contents', () => {
  const emptyBytes = estimateGtfsWorkingRecordBytes([]);
  assert.ok(emptyBytes > 0);
  const scalarBytes = estimateGtfsWorkingRecordBytes([null]) - emptyBytes;
  assert.ok(scalarBytes > 0);
  assert.equal(
    estimateGtfsWorkingRecordBytes([null, 1, 1n, '']),
    emptyBytes + scalarBytes * 4,
  );
  assert.equal(
    estimateGtfsWorkingRecordBytes(['🙂é']) -
      estimateGtfsWorkingRecordBytes(['']),
    '🙂é'.length * 2,
  );
});
