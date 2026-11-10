import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineGtfsTable } from '../../src/schema/define-table.ts';

const definition = {
  filename: 'test.txt',
  tableName: 'test',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['id'],
  keyStrategy: 'columns',
  fields: { id: { kind: 'id' }, time: { kind: 'time' } },
} as const;

for (const { name, overrides, message } of [
  {
    name: 'unknown primary key',
    overrides: { primaryKey: ['missing'] },
    message: 'primary key field missing is not defined',
  },
  {
    name: 'unknown monetary currency',
    overrides: {
      fields: {
        price: { kind: 'real', monetary: { currencyField: 'currency' } },
        ...definition.fields,
      },
    },
    message: 'price currency field currency is not defined',
  },
  {
    name: 'unknown reference condition',
    overrides: {
      fields: {
        ...definition.fields,
        id: {
          kind: 'id',
          references: [{ when: { field: 'missing', equals: 0 } }],
        },
      },
    },
    message: 'id reference 0 condition references unknown field missing',
  },
  {
    name: 'ambiguous condition',
    overrides: {
      fields: {
        ...definition.fields,
        id: {
          kind: 'id',
          references: [{ when: { field: 'time', equals: 0, in: [0] } }],
        },
      },
    },
    message: 'id reference 0 condition must define exactly one of equals or in',
  },
  {
    name: 'missing normalization predicate',
    overrides: {
      fields: {
        ...definition.fields,
        id: { kind: 'id', normalization: [{ when: { field: 'time' } }] },
      },
    },
    message:
      'id normalization 0 condition must define exactly one of equals or in',
  },
  {
    name: 'unknown range field',
    overrides: {
      constraints: [{ kind: 'range', startField: 'id', endField: 'missing' }],
    },
    message: 'range constraint references an unknown field',
  },
  {
    name: 'unknown presence field',
    overrides: {
      constraints: [{ kind: 'conditional-presence', field: 'missing' }],
    },
    message: 'conditional presence constraint references unknown field missing',
  },
  {
    name: 'unknown presence condition',
    overrides: {
      constraints: [
        {
          kind: 'conditional-presence',
          field: 'id',
          when: { field: 'missing', equals: 0 },
        },
      ],
    },
    message: 'id presence condition references unknown field missing',
  },
  {
    name: 'canonical key without primary key',
    overrides: { primaryKey: [], keyStrategy: 'canonical' },
    message: 'a canonical key strategy requires a primary key',
  },
  {
    name: 'none strategy with storage key',
    overrides: { keyStrategy: 'none' },
    message: 'a none key strategy requires a null storage key and vice versa',
  },
  {
    name: 'null storage key with columns strategy',
    overrides: { storageKey: null },
    message: 'a none key strategy requires a null storage key and vice versa',
  },
  {
    name: 'unknown storage field',
    overrides: { storageKey: ['source_id', 'missing'] },
    message: 'storage key field missing is not defined',
  },
  {
    name: 'storage key omits primary field',
    overrides: { storageKey: ['source_id'] },
    message: 'storage key must include primary key field id',
  },
  {
    name: 'unknown index column',
    overrides: { indexes: [['id', 'missing']] },
    message: 'index field missing is not defined',
  },
]) {
  test(`table definition rejects ${name}`, () => {
    assert.throws(
      () => defineGtfsTable({ ...definition, ...overrides } as never),
      {
        message: `Invalid GTFS table test: ${message}`,
      },
    );
  });
}

test('table definition accepts conditional fields, explicit keys, and generated-time indexes', () => {
  const input = {
    ...definition,
    fields: {
      ...definition.fields,
      id: {
        kind: 'id',
        references: [
          {
            targetFilename: 'other.txt',
            targetField: 'id',
            when: { field: 'time', equals: null },
          },
        ],
        normalization: [
          {
            kind: 'source-reference',
            when: { field: 'time', in: ['12:00:00'] },
          },
        ],
      },
    },
    storageKey: ['source_id', 'id'],
    indexes: ['id', ['source_id', 'time_service_day_seconds']],
    constraints: [
      {
        kind: 'conditional-presence',
        field: 'id',
        presence: 'required',
        when: { field: 'time', equals: null },
      },
    ],
  } as const;
  assert.deepEqual(defineGtfsTable(input), input);
  assert.deepEqual(defineGtfsTable(definition).storageKey, ['source_id', 'id']);
});

test('table definition retains primary, field, storage-key, and index diagnostic order', () => {
  const invalid = {
    ...definition,
    primaryKey: ['missing'],
    storageKey: ['source_id', 'unknown'],
    fields: {
      ...definition.fields,
      id: { kind: 'id', references: [{ when: { field: 'unknown' } }] },
    },
    indexes: ['unknown'],
  };
  assert.throws(
    () => defineGtfsTable(invalid as never),
    /primary key field missing is not defined/,
  );
  assert.throws(
    () => defineGtfsTable({ ...invalid, primaryKey: ['id'] } as never),
    /reference 0 condition references unknown field unknown/,
  );
  assert.throws(
    () =>
      defineGtfsTable({
        ...invalid,
        primaryKey: ['id'],
        fields: definition.fields,
      } as never),
    /storage key field unknown is not defined/,
  );
});
