import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { tableDefinitions } from '../../src/schema/table-registry.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';

test('compiled tables retain manifest names and add only computed metadata', () => {
  for (const definition of tableDefinitions) {
    const compiled = compileTable(definition);
    const { columns, ...metadata } = compiled;
    assert.deepEqual(metadata, definition);
    assert.ok(Object.isFrozen(compiled));
    assert.ok(Object.isFrozen(columns));
    for (const column of columns) {
      const { name, valueKind, primaryKey, ...field } = column;
      assert.deepEqual(field, definition.fields[name]);
      assert.equal(primaryKey, definition.primaryKey.includes(name));
      assert.equal(typeof valueKind, 'string');
      assert.ok(Object.isFrozen(column));
    }
  }
});

const table = compileTable(
  defineGtfsTable({
    filename: 'bounds.txt',
    tableName: 'bounds',
    specification: 'gtfs-schedule',
    presence: 'optional',
    keyStrategy: 'columns',
    fields: {
      id: { kind: 'id' },
      lower: { kind: 'integer', minimum: 0 },
      upper: { kind: 'real', maximum: 0 },
      both: { kind: 'real', minimum: -2.5, maximum: 1.5 },
      unconstrained: { kind: 'integer' },
      number_enum: { kind: 'enumeration', values: [0, 1] },
      text_enum: { kind: 'enumeration', values: ['a', 'b'] },
      amount: {
        kind: 'real',
        monetary: {
          currencyField: 'currency',
          publicRepresentation: 'decimal-string',
          storageRepresentation: 'minor-units',
        },
      },
      currency: { kind: 'text' },
    },
  }),
);

test('compiled value kinds remain transformations of source field kinds', () => {
  assert.deepEqual(
    Object.fromEntries(
      table.columns.map(({ name, valueKind }) => [name, valueKind]),
    ),
    {
      id: 'text',
      lower: 'integer',
      upper: 'real',
      both: 'real',
      unconstrained: 'integer',
      number_enum: 'integer',
      text_enum: 'text',
      amount: 'integer',
      currency: 'text',
    },
  );
});

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  test(`${dialect} storage planning uses original minimum and maximum values`, () => {
    const plan = createGtfsStoragePlan({ dialect, tables: [table] });
    const planned = plan.tables[0];
    assert.ok(planned);
    assert.deepEqual(
      Object.fromEntries(
        planned.columns
          .filter(({ role }) => role === 'manifest')
          .map(({ name, checks }) => [
            name,
            checks.filter(({ kind }) => kind === 'range'),
          ]),
      ),
      {
        id: [],
        lower: [{ kind: 'range', minimum: 0 }],
        upper: [{ kind: 'range', maximum: 0 }],
        both: [{ kind: 'range', minimum: -2.5, maximum: 1.5 }],
        unconstrained: [],
        number_enum: [],
        text_enum: [],
        amount: [],
        currency: [],
      },
    );
  });
}
