import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { agency } from '../../src/schema/managed-tables.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { describe, it } from 'node:test';

const scalarFixture = compileTable(
  defineGtfsTable({
    filename: 'scalar_fixture.txt',
    tableName: 'scalar_fixture',
    specification: 'gtfs-schedule',
    presence: 'optional',
    keyStrategy: 'columns',
    fields: {
      identifier: { kind: 'id' },
      text_value: { kind: 'text' },
      integer_value: { kind: 'integer' },
      real_value: { kind: 'real' },
      numeric_enum: { kind: 'enumeration', values: [0, 1, 2] },
      text_enum: { kind: 'enumeration', values: ['OPEN', 'CLOSED'] },
      date_value: { kind: 'date' },
      time_value: { kind: 'time' },
      json_value: { kind: 'json' },
      amount: {
        kind: 'real',
        monetary: {
          currencyField: 'currency',
          publicRepresentation: 'decimal-string',
          storageRepresentation: 'minor-units',
        },
      },
      currency: { kind: 'text' },
      nullable_value: { kind: 'integer' },
      defaulted_value: { kind: 'integer', defaultValue: 7 },
    },
  }),
);

describe('GTFS row normalization', () => {
  it('plans columns once per table without retaining row or source-specific values', () => {
    let columnReads = 0;
    const table = {
      ...scalarFixture,
      get columns() {
        columnReads += 1;
        return scalarFixture.columns;
      },
    };
    const first = normalizeGtfsRecord(
      {
        time_value: '25:1:2',
        amount: '2.50',
        currency: 'USD',
        custom: 'first',
      },
      table,
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'first',
        onUnknownField: 'preserve',
      },
    );
    const second = normalizeGtfsRecord(
      {
        time_value: '',
        amount: '300',
        currency: 'JPY',
        custom: 'second',
        omitted: undefined,
      },
      table,
      {
        position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
        sourceId: 'second',
        onUnknownField: 'preserve',
      },
    );
    const third = normalizeGtfsRecord({ custom: 'discarded' }, table, {
      position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
      sourceId: 'third',
      onUnknownField: 'discard',
    });

    assert.equal(columnReads, 1);
    assert.equal(first.source_id, 'first');
    assert.equal(first.time_value, '25:01:02');
    assert.equal(first.time_value_service_day_seconds, 90062);
    assert.equal(first.amount, 250n);
    assert.equal(first._unknown_fields, '{"custom":"first"}');
    assert.equal(second.source_id, 'second');
    assert.equal(second.time_value, null);
    assert.equal(second.time_value_service_day_seconds, null);
    assert.equal(second.amount, 300n);
    assert.equal(second._unknown_fields, '{"custom":"second"}');
    assert.equal(third.amount, null);
    assert.equal(Object.hasOwn(third, '_unknown_fields'), false);
    assert.deepEqual(Object.keys(first), Object.keys(second));
    assert.deepEqual(
      Object.keys(third),
      Object.keys(first).filter((field) => field !== '_unknown_fields'),
    );
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(second));
  });

  it('preserves unusual unknown field names without changing the row prototype', () => {
    const record = Object.fromEntries([
      ['identifier', 'known'],
      ['__proto__', 'own value'],
      ['constructor', 'data'],
      ['toString', ''],
      ['nullable', null],
      ['omitted', undefined],
    ]);
    const row = normalizeGtfsRecord(record, scalarFixture, {
      position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
      sourceId: 'source',
      onUnknownField: 'preserve',
    });
    assert.equal(Object.getPrototypeOf(row), Object.prototype);
    assert.equal(row.identifier, 'known');
    assert.equal(
      row._unknown_fields,
      '{"__proto__":"own value","constructor":"data","toString":"","nullable":null}',
    );
  });

  it(
    'retains wide normalized rows within a 64 MiB heap',
    { timeout: 30_000 },
    async () => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--disable-warning=ExperimentalWarning',
          'test/helpers/normalization-memory.ts',
        ],
        { timeout: 25_000 },
      );
      assert.match(stdout, /Normalized 40000 wide records/);
    },
  );

  it('keeps distinct schemas with the same table name isolated and honors defaults', () => {
    const tables = ['known', 'different'].map((field) =>
      compileTable(
        defineGtfsTable({
          filename: 'defaults.txt',
          tableName: 'defaults',
          specification: 'gtfs-schedule',
          presence: 'optional',
          keyStrategy: 'none',
          storageKey: null,
          fields: {
            [field]: { kind: 'text' },
            time: { kind: 'time', defaultValue: '9:5:1' },
            amount: {
              kind: 'real',
              monetary: {
                currencyField: 'currency',
                publicRepresentation: 'decimal-string',
                storageRepresentation: 'minor-units',
              },
              defaultValue: 2.5,
            },
            currency: { kind: 'text', defaultValue: 'USD' },
          },
        }),
      ),
    );
    const rows = tables.map((table) =>
      normalizeGtfsRecord({ known: 'value' }, table, {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'source',
        onUnknownField: 'preserve',
      }),
    );
    assert.equal(rows[0]?._unknown_fields, null);
    assert.equal(rows[1]?._unknown_fields, '{"known":"value"}');
    for (const row of rows) {
      assert.equal(row.time, '09:05:01');
      assert.equal(row.time_service_day_seconds, 32701);
      assert.equal(row.amount, 250n);
    }
  });

  it('produces one backend-neutral typed row for every scalar kind', () => {
    const row = normalizeGtfsRecord(
      {
        identifier: 'item-1',
        text_value: 'Example',
        integer_value: '42',
        real_value: '3.125',
        numeric_enum: '2',
        text_enum: 'OPEN',
        date_value: '2026-08-25',
        time_value: '9:5:1',
        json_value: '{"b":2,"a":1}',
        amount: '2.50',
        currency: 'USD',
        nullable_value: '',
        defaulted_value: '',
      },
      scalarFixture,
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'scalar-source',
      },
    );

    assert.deepEqual(row, {
      source_id: 'scalar-source',
      identifier: 'item-1',
      text_value: 'Example',
      integer_value: 42,
      real_value: 3.125,
      numeric_enum: 2,
      text_enum: 'OPEN',
      date_value: 20_260_825,
      time_value: '09:05:01',
      json_value: '{"b":2,"a":1}',
      amount: 250n,
      currency: 'USD',
      nullable_value: null,
      defaulted_value: 7,
      time_value_service_day_seconds: 32_701,
    });
    assert.equal(Object.isFrozen(row), true);
  });

  it('backfills agency IDs while retaining source identity separately', () => {
    const row = normalizeGtfsRecord(
      {
        agency_name: 'Example Transit',
        agency_url: 'https://example.com',
        agency_timezone: 'America/Los_Angeles',
      },
      compileTable(agency),
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'agency-source',
        defaultAgencyId: 'default-agency',
      },
    );

    assert.equal(row.source_id, 'agency-source');
    assert.equal(row.agency_id, 'default-agency');
  });

  it('rejects values that cannot satisfy their declared primitive type', () => {
    assert.throws(
      () =>
        normalizeGtfsRecord({ integer_value: '4.2' }, scalarFixture, {
          position: { kind: 'csv', recordNumber: 4, csvLineNumber: 5 },
          sourceId: 'invalid-source',
        }),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === GtfsErrorCode.INVALID_VALUE,
    );
  });

  it('uses the required-value code and source position for missing values', () => {
    assert.throws(
      () =>
        normalizeGtfsRecord(
          {
            agency_url: 'https://example.com',
            agency_timezone: 'America/Los_Angeles',
          },
          compileTable(agency),
          {
            position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
            sourceId: 'invalid-source',
          },
        ),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.REQUIRED_VALUE_MISSING);
        assert.deepEqual(error.position, {
          kind: 'csv',
          recordNumber: 3,
          csvLineNumber: 4,
        });
        assert.deepEqual(error.details, {
          filename: 'agency.txt',
          field: 'agency_name',
        });
        return true;
      },
    );
  });

  it('preserves unknown open-enum values in their declared primitive', () => {
    const row = normalizeGtfsRecord(
      { numeric_enum: '7', text_enum: 'FUTURE_VALUE' },
      scalarFixture,
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'enum-source',
      },
    );

    assert.equal(row.numeric_enum, 7);
    assert.equal(row.text_enum, 'FUTURE_VALUE');
    assert.equal(
      scalarFixture.columns.find(({ name }) => name === 'numeric_enum')
        ?.valueKind,
      'integer',
    );
    assert.equal(
      scalarFixture.columns.find(({ name }) => name === 'text_enum')?.valueKind,
      'text',
    );
  });
});
