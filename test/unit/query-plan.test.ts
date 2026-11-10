import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { compilePortableQueryPlan } from '../../src/database/kysely/query/plan.ts';
import type { PortableFindManyOptions } from '../../src/database/kysely/query/types.ts';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import type { CompiledGtfsTable } from '../../src/schema/compile-table.ts';
import { gtfsManifest } from '../../src/schema/manifest.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';

const routes = compiledTableRegistry.routes;

function assertInvalidPlan({
  options,
  details,
  table = routes,
}: {
  options: PortableFindManyOptions;
  details: Record<string, unknown>;
  table?: CompiledGtfsTable;
}): void {
  assert.throws(
    () => compilePortableQueryPlan(table, options),
    (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.QUERY_INVALID);
      assert.equal(error.category, GtfsErrorCategory.QUERY);
      assert.deepEqual(error.details, details);
      assert.ok(error.message.length > 0);
      return true;
    },
  );
}

describe('portable query-plan validation', () => {
  test('rejects an empty selection', () => {
    assertInvalidPlan({
      options: { select: [] },
      details: { table: 'routes' },
    });
  });

  for (const select of [
    ['route_id', 'route_id'],
    ['route_id', 'route_short_name', 'route_id'],
    ['source_id', 'route_id', 'source_id'],
  ]) {
    test(`rejects duplicate selection ${JSON.stringify(select)}`, () => {
      assertInvalidPlan({
        options: { select },
        details: { table: 'routes', field: select[0] },
      });
    });
  }

  for (const name of ['limit', 'offset'] as const) {
    for (const value of [
      -1,
      0.5,
      -0.5,
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
      Infinity,
      -Infinity,
      '10',
      '',
      null,
      true,
      false,
      1n,
      [],
      {},
    ]) {
      test(`rejects ${name}=${String(value)} (${typeof value})`, () => {
        assertInvalidPlan({
          options: { [name]: value } as never,
          details: { [name]: value },
        });
      });
    }
  }

  test('rejects a table not registered in the manifest', () => {
    assertInvalidPlan({
      table: { ...routes, tableName: 'unknown_table' },
      options: {},
      details: { table: 'unknown_table' },
    });
  });

  for (const field of ['unknown_field', '*', 'routeId', '']) {
    test(`rejects unknown selected field ${JSON.stringify(field)}`, () => {
      assertInvalidPlan({
        options: { select: ['route_id', field] },
        details: { table: 'routes', field },
      });
    });
  }

  test('rejects selecting a private storage column instead of its public name', () => {
    assertInvalidPlan({
      table: compiledTableRegistry.stopTimes,
      options: { select: ['arrival_timestamp'] },
      details: { table: 'stop_times', field: 'arrival_timestamp' },
    });
  });

  for (const direction of [
    'ASC',
    'DESC',
    'ascending',
    '',
    null,
    true,
    1,
    [],
    {},
  ]) {
    test(`rejects sort direction ${JSON.stringify(direction)}`, () => {
      assertInvalidPlan({
        options: { orderBy: [{ field: 'route_id', direction }] } as never,
        details: {
          table: 'routes',
          field: 'route_id',
          direction,
          expectedDirections: ['asc', 'desc'],
        },
      });
    });
  }

  for (const field of ['unknown_field', '', undefined, null, 1, true, []]) {
    test(`rejects sort field ${String(field)} (${typeof field})`, () => {
      assertInvalidPlan({
        options: { orderBy: [{ field }] } as never,
        details: { table: 'routes', field },
      });
    });
  }

  test('uses default selections and omits unspecified pagination', () => {
    const plan = compilePortableQueryPlan(routes, {});
    assert.deepEqual(
      plan.selectedFields.map((field) => field.publicName),
      gtfsManifest.routes.defaultSelectedFields,
    );
    assert.deepEqual(plan.orderBy, []);
    assert.equal('limit' in plan, false);
    assert.equal('offset' in plan, false);
  });

  for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
    test(`preserves valid pagination boundary ${value}`, () => {
      const plan = compilePortableQueryPlan(routes, {
        limit: value,
        offset: value,
      });
      assert.equal(plan.limit, value);
      assert.equal(plan.offset, value);
    });
  }

  test('preserves projection and sort order, defaults to asc, and resolves derived fields', () => {
    const plan = compilePortableQueryPlan(compiledTableRegistry.stopTimes, {
      select: ['arrival_service_day_seconds', 'trip_id', 'source_id'],
      orderBy: [
        { field: 'trip_id' },
        { field: 'arrival_service_day_seconds', direction: 'desc' },
        { field: 'source_id', direction: 'asc' },
      ],
    });
    assert.deepEqual(
      plan.selectedFields.map(({ publicName, storageName }) => ({
        publicName,
        storageName,
      })),
      [
        {
          publicName: 'arrival_service_day_seconds',
          storageName: 'arrival_service_day_seconds',
        },
        { publicName: 'trip_id', storageName: 'trip_id' },
        { publicName: 'source_id', storageName: 'source_id' },
      ],
    );
    assert.deepEqual(
      plan.orderBy.map(({ field, direction }) => [
        field.storageName,
        direction,
      ]),
      [
        ['trip_id', 'asc'],
        ['arrival_service_day_seconds', 'desc'],
        ['source_id', 'asc'],
      ],
    );
  });
});
