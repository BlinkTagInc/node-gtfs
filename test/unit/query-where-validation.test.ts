import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isGtfsError } from '../../src/diagnostics/errors.ts';
import { assertDefinedWhereValues } from '../../src/query/where-validation.ts';
import { compileRepositoryFilters } from '../../src/query/filters.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';

const cases = [
  { where: { route_id: undefined }, field: 'route_id', path: 'where.route_id' },
  {
    where: { route_desc: [undefined] },
    field: 'route_desc',
    path: 'where.route_desc[0]',
  },
  {
    where: { route_desc: [null, 'name', undefined] },
    field: 'route_desc',
    path: 'where.route_desc[2]',
  },
  {
    where: { route_desc: new Array(1) },
    field: 'route_desc',
    path: 'where.route_desc[0]',
  },
  { where: { agency: undefined }, field: 'agency', path: 'where.agency' },
  {
    where: { agency: { is: undefined } },
    field: 'agency',
    path: 'where.agency.is',
  },
  {
    where: { agency: { isNot: undefined } },
    field: 'agency',
    path: 'where.agency.isNot',
  },
  {
    where: { trips: { some: undefined } },
    field: 'trips',
    path: 'where.trips.some',
  },
  {
    where: { trips: { none: undefined } },
    field: 'trips',
    path: 'where.trips.none',
  },
  {
    where: { trips: { every: undefined } },
    field: 'trips',
    path: 'where.trips.every',
  },
  {
    where: { trips: { some: { block_id: undefined } } },
    field: 'trips',
    path: 'where.trips.some.block_id',
  },
  {
    where: { trips: { some: { serviceDate: undefined } } },
    field: 'trips',
    path: 'where.trips.some.serviceDate',
  },
  {
    where: {
      trips: { some: { stopTimes: { some: { stop_id: [null, undefined] } } } },
    },
    field: 'trips',
    path: 'where.trips.some.stopTimes.some.stop_id[1]',
  },
];

for (const { where, field, path } of cases) {
  test(`undefined filter values report their exact path: ${path}`, () => {
    assert.throws(
      () =>
        compileRepositoryFilters({
          dialect: 'sqlite',
          table: compiledTableRegistry.routes,
          where,
        }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, 'GTFS_QUERY_INVALID');
        assert.equal(error.category, 'query');
        assert.deepEqual(error.details, {
          table: 'routes',
          field,
          path,
          reason: 'undefined-filter-value',
        });
        assert.equal(
          error.message,
          `\`${path}\` must not be undefined; use null for a nullable field or omit the property to leave it unfiltered`,
        );
        return true;
      },
    );
  });
}

test('the defined-value check preserves null, false, zero, empty strings, empty arrays and shared filter objects', () => {
  const shared = { route_id: 'red', route_desc: null };
  const where = {
    a: shared,
    b: shared,
    empty: [],
    values: [false, 0, 0n, '', null],
    nested: { some: {} },
  };
  assert.doesNotThrow(() => assertDefinedWhereValues(where, 'routes'));
  assert.deepEqual(
    compileRepositoryFilters({
      dialect: 'sqlite',
      table: compiledTableRegistry.routes,
      where: {},
    }).additionalWhere,
    [],
  );
  assert.equal(
    compileRepositoryFilters({
      dialect: 'sqlite',
      table: compiledTableRegistry.routes,
      where: { route_desc: null },
    }).additionalWhere.length,
    1,
  );
});

test('circular filters reject instead of recursing indefinitely', () => {
  const where: Record<string, unknown> = {};
  where.trips = { some: where };
  assert.throws(
    () =>
      compileRepositoryFilters({
        dialect: 'sqlite',
        table: compiledTableRegistry.routes,
        where,
      }),
    (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, 'GTFS_QUERY_INVALID');
      assert.deepEqual(error.details, {
        table: 'routes',
        path: 'where.trips.some',
        reason: 'circular-filter-value',
      });
      return true;
    },
  );
});
