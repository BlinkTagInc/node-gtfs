import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import { parseGtfsPrimitiveValue } from '../../src/values/parse.ts';
import { collectStagedImportBatches } from '../helpers/import-batches.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { validateGtfsPrimitiveRows } from '../../src/validation/rows.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';

const table: FileBackedCompiledGtfsTable = {
  ...compileTable(
    defineGtfsTable({
      filename: 'primitives.txt',
      tableName: 'primitives',
      specification: 'gtfs-schedule',
      presence: 'optional',
      keyStrategy: 'columns',
      fields: {
        integer: { kind: 'integer' },
        real: { kind: 'real' },
        date: { kind: 'date' },
        time: { kind: 'time' },
        json: { kind: 'json' },
        amount: {
          kind: 'real',
          monetary: {
            currencyField: 'currency',
            publicRepresentation: 'decimal-string',
            storageRepresentation: 'minor-units',
          },
        },
        currency: { kind: 'text', defaultValue: 'USD' },
        numeric_enum: { kind: 'enumeration', values: [0, 1] },
        text_enum: { kind: 'enumeration', values: ['OPEN', 'CLOSED'] },
      },
    }),
  ),
  filename: 'primitives.txt',
};

const cases: readonly {
  field: string;
  input: string;
  expected?: string | number | bigint;
  reason?: string;
  currency?: string;
  serviceDaySeconds?: number;
}[] = [
  { field: 'integer', input: '+42', expected: 42 },
  {
    field: 'integer',
    input: '-9007199254740991',
    expected: -Number.MAX_SAFE_INTEGER,
  },
  {
    field: 'integer',
    input: '9007199254740991',
    expected: Number.MAX_SAFE_INTEGER,
  },
  { field: 'integer', input: '9007199254740992', reason: 'unsafe-integer' },
  { field: 'integer', input: '-9007199254740992', reason: 'unsafe-integer' },
  { field: 'integer', input: '4.2', reason: 'invalid-integer' },
  { field: 'integer', input: '1e2', reason: 'invalid-integer' },
  { field: 'real', input: '3.125', expected: 3.125 },
  { field: 'real', input: '1e2', expected: 100 },
  { field: 'real', input: 'NaN', reason: 'invalid-real' },
  { field: 'real', input: 'Infinity', reason: 'invalid-real' },
  { field: 'real', input: '1e309', reason: 'invalid-real' },
  { field: 'date', input: '20240229', expected: 20240229 },
  { field: 'date', input: '2024-02-29', expected: 20240229 },
  { field: 'date', input: '2024/02/29', reason: 'invalid-date' },
  { field: 'date', input: '2024022', reason: 'invalid-date' },
  {
    field: 'time',
    input: '9:5:1',
    expected: '09:05:01',
    serviceDaySeconds: 32701,
  },
  {
    field: 'time',
    input: '25:00:00',
    expected: '25:00:00',
    serviceDaySeconds: 90000,
  },
  { field: 'time', input: '1:2:3:4', reason: 'invalid-time' },
  { field: 'time', input: '12:60:00', reason: 'invalid-time' },
  { field: 'time', input: '9007199254740992:00:00', reason: 'invalid-time' },
  { field: 'json', input: '{ "a": [1, true] }', expected: '{"a":[1,true]}' },
  { field: 'json', input: 'null', expected: 'null' },
  { field: 'json', input: '{', reason: 'invalid-json' },
  { field: 'amount', input: '2.50', expected: 250n },
  { field: 'amount', input: '.50', expected: 50n },
  { field: 'amount', input: '-2', expected: -200n },
  { field: 'amount', input: '2.501', reason: 'invalid-money' },
  { field: 'amount', input: '1e2', reason: 'invalid-money' },
  {
    field: 'amount',
    input: '92233720368547758.07',
    expected: 9223372036854775807n,
  },
  { field: 'amount', input: '92233720368547758.08', reason: 'invalid-money' },
  { field: 'amount', input: '2.50', currency: 'ZZZ', reason: 'invalid-money' },
  { field: 'amount', input: '2.50', currency: 'JPY', reason: 'invalid-money' },
  { field: 'amount', input: '2.501', currency: 'KWD', expected: 2501n },
  { field: 'numeric_enum', input: '7', expected: 7 },
  {
    field: 'numeric_enum',
    input: '9007199254740992',
    reason: 'unsafe-integer',
  },
  { field: 'text_enum', input: 'FUTURE', expected: 'FUTURE' },
];

describe('shared GTFS primitive parsing', () => {
  it('uses parsed time seconds for inclusive bounds while retaining monetary bounds in major units', () => {
    const boundedTable = {
      ...table,
      columns: table.columns.map((column) => {
        if (column.name === 'time') {
          return { ...column, minimum: 3600, maximum: 90000 };
        }
        if (column.name === 'amount') {
          return { ...column, minimum: 1, maximum: 3 };
        }
        return column;
      }),
    };
    const notices = validateGtfsPrimitiveRows({
      options: {
        directory: '',
        tables: [boundedTable],
        mode: 'strict',
        onUnknownField: 'discard',
      },
      table: boundedTable,
      source: {
        headers: ['time', 'amount', 'currency'],
        records: [
          { time: '1:0:0', amount: '1.00', currency: 'USD' },
          { time: '25:00:00', amount: '3.00', currency: 'USD' },
          { time: '0:59:59', amount: '.99', currency: 'USD' },
          { time: '25:00:01', amount: '3.01', currency: 'USD' },
          { time: '1:60:00', amount: 'invalid', currency: 'USD' },
        ].map((row, index) => ({
          row,
          position: {
            kind: 'csv' as const,
            recordNumber: index + 1,
            csvLineNumber: index + 2,
          },
        })),
      },
    });
    assert.deepEqual(
      notices.map(({ code, position, field }) => ({ code, position, field })),
      [
        {
          code: GtfsValidationNoticeCode.RANGE,
          position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
          field: 'time',
        },
        {
          code: GtfsValidationNoticeCode.RANGE,
          position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
          field: 'amount',
        },
        {
          code: GtfsValidationNoticeCode.RANGE,
          position: { kind: 'csv', recordNumber: 4, csvLineNumber: 5 },
          field: 'time',
        },
        {
          code: GtfsValidationNoticeCode.RANGE,
          position: { kind: 'csv', recordNumber: 4, csvLineNumber: 5 },
          field: 'amount',
        },
        {
          code: GtfsValidationNoticeCode.INVALID_VALUE,
          position: { kind: 'csv', recordNumber: 5, csvLineNumber: 6 },
          field: 'time',
        },
        {
          code: GtfsValidationNoticeCode.INVALID_VALUE,
          position: { kind: 'csv', recordNumber: 5, csvLineNumber: 6 },
          field: 'amount',
        },
      ],
    );
  });

  for (const {
    field,
    input,
    expected,
    reason,
    currency = 'USD',
    serviceDaySeconds,
  } of cases) {
    it(`${field}: ${JSON.stringify(input)} (${currency}) agrees across parsing, validation, and normalization`, () => {
      const column = table.columns.find(
        (candidate) => candidate.name === field,
      );
      assert.ok(column);
      const row = { [field]: input, currency };
      assert.deepEqual(
        parseGtfsPrimitiveValue(input, column, row),
        reason
          ? { valid: false, reason }
          : {
              valid: true,
              value: expected,
              ...(serviceDaySeconds === undefined ? {} : { serviceDaySeconds }),
            },
      );

      for (const mode of ['off', 'strict', 'permissive'] as const) {
        const notices = validateGtfsPrimitiveRows({
          options: {
            directory: '',
            tables: [table],
            mode,
            onUnknownField: 'discard',
          },
          table,
          source: {
            headers: Object.keys(row),
            records: [
              {
                row,
                position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
              },
            ],
          },
        });
        assert.deepEqual(
          notices,
          reason && mode !== 'off'
            ? [
                {
                  code: GtfsValidationNoticeCode.INVALID_VALUE,
                  severity: 'error',
                  message: `primitives.txt CSV record 1 (ending at line 2) has invalid ${column.kind} value for "${field}"`,
                  filename: 'primitives.txt',
                  position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
                  field,
                  details: { value: input, expectedKind: column.kind },
                },
              ]
            : [],
        );
      }

      const normalize = () =>
        normalizeGtfsRecord(row, table, {
          position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
          sourceId: 'test',
        });
      if (reason) {
        assert.throws(normalize, (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(
            error.code,
            reason === 'invalid-date'
              ? GtfsErrorCode.INVALID_DATE
              : GtfsErrorCode.INVALID_VALUE,
          );
          assert.equal(error.category, 'validation');
          assert.deepEqual(error.position, {
            kind: 'csv',
            recordNumber: 1,
            csvLineNumber: 2,
          });
          assert.deepEqual(error.details, {
            filename: 'primitives.txt',
            field,
            value: input,
            ...(reason === 'invalid-date' ? {} : { expectedKind: column.kind }),
          });
          return true;
        });
      } else {
        assert.equal(normalize()[field], expected);
      }
    });
  }

  it('handles typed input, JSON serialization failures, and currency defaults', () => {
    const jsonColumn = table.columns.find(({ name }) => name === 'json');
    const integerColumn = table.columns.find(({ name }) => name === 'integer');
    assert.ok(jsonColumn);
    assert.ok(integerColumn);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const input of [undefined, () => {}, 1n, circular]) {
      assert.deepEqual(parseGtfsPrimitiveValue(input, jsonColumn, {}), {
        valid: false,
        reason: 'invalid-json',
      });
    }
    assert.deepEqual(
      parseGtfsPrimitiveValue(9007199254740992, integerColumn, {}),
      {
        valid: false,
        reason: 'unsafe-integer',
      },
    );
    const normalized = normalizeGtfsRecord(
      {
        integer: 42,
        real: 3.125,
        date: 20240229,
        json: { a: true },
        amount: '2.50',
      },
      table,
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'test',
      },
    );
    assert.equal(normalized.integer, 42);
    assert.equal(normalized.real, 3.125);
    assert.equal(normalized.date, 20240229);
    assert.equal(normalized.json, '{"a":true}');
    assert.equal(normalized.amount, 250n);
    assert.equal(normalized.currency, 'USD');
    assert.equal(normalized.time, null);
  });

  it('reports unsafe stop_sequence values and preserves rejection/skip policies', async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-primitives-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, 'stop_times.txt');
    await writeFile(
      filePath,
      'trip_id,stop_sequence\ntrip,1\ntrip,9007199254740992\ntrip,3\n',
    );
    const stopTimes = compiledTableRegistry.stopTimes;
    for (const mode of ['strict', 'permissive'] as const) {
      const staged = await stageGtfsSource({
        sourceId: 'test',
        directory,
        tables: [stopTimes],
        mode,
        onUnknownField: 'discard',
        excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
      });
      t.after(() => staged.close());
      const result = staged.validation;
      assert.equal(result.valid, false);
      assert.equal(result.shouldReject, mode === 'strict');
      assert.deepEqual(result.samples, [
        {
          code: GtfsValidationNoticeCode.INVALID_VALUE,
          severity: 'error',
          sourceId: 'test',
          filename: 'stop_times.txt',
          position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
          field: 'stop_sequence',
          message:
            'stop_times.txt CSV record 2 (ending at line 3) has invalid integer value for "stop_sequence"',
          details: { value: '9007199254740992', expectedKind: 'integer' },
        },
      ]);
    }
    const collect = async (mode: 'off' | 'permissive') => {
      const batches = await collectStagedImportBatches({
        directory,
        tables: [stopTimes],
        sourceId: 'test',
        mode,
        onUnknownField: 'preserve',
        batchSize: 1,
      });
      return batches.flatMap((batch) =>
        batch.records.map(({ row }) => row.stop_sequence),
      );
    };
    await assert.rejects(() => collect('off'), { code: 'GTFS_INVALID_VALUE' });
    assert.deepEqual(await collect('permissive'), [1, 3]);
  });
});
