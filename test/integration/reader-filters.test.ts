import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import Database from 'better-sqlite3';
import { sql } from 'kysely';
import { Gtfs, isGtfsError } from '../../src/index.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { compileRepositoryFilters } from '../../src/query/filters.ts';
import { resolveQueryWhere } from '../../src/query/equality.ts';
let statements = 0;
const sqlite = new Database(':memory:', {
  verbose() {
    statements += 1;
  },
});
const gtfs = new Gtfs({
  database: { client: sqlite },
  sources: [{ sourceId: 'north' }],
  reporting: { level: 'silent' },
});
before(async () => {
  await gtfs.schema.ensure();
  sqlite.exec(`
    INSERT INTO routes (source_id, route_id, route_type, route_desc) VALUES
      ('north', 'red', 3, 'Red'), ('north', 'blue', 3, 'Blue'),
      ('north', 'empty', 3, NULL), ('south', 'red', 3, 'Red');
    INSERT INTO trips (source_id, trip_id, route_id, service_id) VALUES
      ('north', 'a', 'red', 'weekday'), ('north', 'b', 'blue', 'weekday'),
      ('north', 'c', 'red', 'weekday'), ('north', 'd', 'red', 'weekday'),
      ('north', 'orphan', 'missing', 'weekday'), ('south', 'a', 'red', 'weekday');
    INSERT INTO stops (source_id, stop_id, stop_name, stop_lat, stop_lon) VALUES
      ('north', 'platform', 'Platform', 0, 0), ('south', 'platform', 'Platform', 0, 0);
    INSERT INTO stop_times (source_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time) VALUES
      ('north', 'a', 1, 'platform', '9:00:00', '09:01:00'),
      ('north', 'b', 2, 'platform', '10:00:00', '10:05:00'),
      ('north', 'c', 3, 'platform', '25:00:00', '25:01:00'),
      ('north', 'd', 4, 'platform', NULL, NULL),
      ('south', 'a', 1, 'platform', '08:00:00', '08:01:00');
    INSERT INTO calendar_dates (source_id, service_id, date, exception_type) VALUES
      ('north', 'weekday', 20260911, 1);
    INSERT INTO fare_attributes (source_id, fare_id, price, currency_type, payment_method)
      VALUES ('north', 'small', 123, 'USD', 0), ('north', 'large', 124, 'USD', 0);
  `);
});
after(async () => {
  await gtfs.close();
  sqlite.close();
});
test('equality preserves numeric times, nulls, scope and chained contradictions', async () => {
  for (const [where, expected] of [
    [{ stop_sequence: 2 }, ['b']],
    [{ arrival_time: null }, ['d']],
    [{ arrival_time: '09:00:00' }, ['a']],
    [{ departure_time: '25:01:00' }, ['c']],
    [{ source_id: 'south' }, []],
  ] as const) {
    const query = gtfs.schedule.stopTimes.where(where).select('trip_id');
    assert.deepEqual(
      await query.all(),
      expected.map((trip_id) => ({ trip_id })),
    );
    assert.deepEqual(
      await query.first(),
      expected[0] === undefined ? null : { trip_id: expected[0] },
    );
    assert.equal(await query.count(), expected.length);
  }
  const query = gtfs.schedule.stopTimes.where({ stop_sequence: 1 });
  assert.deepEqual(await query.where({ stop_sequence: 2 }).all(), []);
  assert.equal(await query.first({ stop_sequence: 2 }), null);
  assert.equal(await query.where({ stop_sequence: 2 }).count(), 0);
  // Chaining does not build a recursively nested boolean tree.
  let repeated = query;
  for (let index = 0; index < 150; index += 1) {
    repeated = repeated.where({ source_id: 'north' });
  }
  assert.equal(await repeated.count(), 1);
});
test('monetary equality finds currency across chained filters in either order', async () => {
  for (const query of [
    gtfs.schedule.fareAttributes.where({ price: '1.23', currency_type: 'USD' }),
    gtfs.schedule.fareAttributes
      .where({ price: '1.23' })
      .where({ currency_type: 'USD' }),
    gtfs.schedule.fareAttributes
      .where({ currency_type: 'USD' })
      .where({ price: '1.23' }),
  ]) {
    assert.deepEqual(await query.select('fare_id', 'price').all(), [
      { fare_id: 'small', price: '1.23' },
    ]);
    assert.equal(await query.count(), 1);
    assert.equal(await query.first({ currency_type: 'EUR' }), null);
  }
  await assert.rejects(
    () => gtfs.schedule.fareAttributes.where({ price: '1.23' }).count(),
    { code: 'GTFS_QUERY_INVALID' },
  );
});
test('GeoJSON shares comparisons, boolean groups and nested time filters', async () => {
  const stops = await gtfs.geojson.stops({
    sqlWhere: (eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom('stop_times as selected_time')
            .select('selected_time.trip_id')
            .whereRef('selected_time.source_id', '=', 'stops.source_id')
            .whereRef('selected_time.stop_id', '=', 'stops.stop_id')
            .where('selected_time.arrival_service_day_seconds', '>=', 90000),
        ),
        eb('stops.stop_lat', '<', 0),
      ]),
  });
  assert.equal(stops.features.length, 1);
  assert.equal(stops.features[0]?.properties.source_id, 'north');
});
test('unsupported equality-object shapes reject before SQL', () => {
  for (const where of [
    { stop_sequence: { gt: 1 } },
    { stop_sequence: [1] },
    { trip: { some: { trip_id: 'a' } } },
    { OR: [{ stop_sequence: 1 }] },
    { unknown: 1 },
    { constructor: {} },
    { toString: 'test' },
    JSON.parse('{"__proto__":{"in":["test"]}}'),
  ]) {
    statements = 0;
    assert.throws(() => gtfs.schedule.stopTimes.where(where as never), {
      code: 'GTFS_QUERY_INVALID',
    });
    assert.equal(statements, 0);
  }
});

test('equality compilation validates scalar operands', () => {
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, true, '1']) {
    assert.throws(
      () =>
        compileRepositoryFilters({
          dialect: 'sqlite',
          table: compiledTableRegistry.stopTimes,
          where: { stop_sequence: value },
        }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, 'GTFS_QUERY_INVALID');
        assert.equal(error.details?.field, 'stop_sequence');
        assert.equal(error.details?.value, value);
        return true;
      },
    );
  }
  for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
    assert.doesNotThrow(() =>
      compileRepositoryFilters({
        dialect: 'sqlite',
        table: compiledTableRegistry.stopTimes,
        where: { stop_sequence: value },
      }),
    );
  }
});
test('public query terminals reject invalid numeric operands before SQL', async () => {
  for (const terminal of [
    () => gtfs.schedule.stopTimes.where({ stop_sequence: 1.5 }).all(),
    () => gtfs.schedule.stopTimes.where({ stop_sequence: 1.5 }).first(),
    () => gtfs.schedule.stopTimes.where({ stop_sequence: 1.5 }).count(),
  ]) {
    statements = 0;
    await assert.rejects(
      async () => terminal(),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, 'GTFS_QUERY_INVALID');
        assert.equal(error.details?.field, 'stop_sequence');
        assert.equal(error.details?.value, 1.5);
        return true;
      },
    );
    assert.equal(statements, 0);
  }
});

test('date comparisons validate calendar values at the compiler boundary', () => {
  const table = compiledTableRegistry.calendarDates;
  const compile = (value: unknown) =>
    compileRepositoryFilters({
      dialect: 'sqlite',
      table,
      where: resolveQueryWhere(table, { date: value }),
    });
  for (const value of [20260229, '20260911', NaN]) {
    assert.throws(
      () => compile(value),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, 'GTFS_QUERY_INVALID');
        assert.equal(error.details?.field, 'date');
        assert.deepEqual(error.details?.value, value);
        return true;
      },
    );
  }
  assert.doesNotThrow(() => compile(20240229));
  assert.doesNotThrow(() => compile(20260911));
});
test('cycles and excessive nesting reject safely before SQL', async () => {
  const cycle: Record<string, unknown> = {};
  cycle.NOT = cycle;
  let deep: Record<string, unknown> = {};
  for (let index = 0; index < 110; index += 1) {
    deep = { NOT: deep };
  }
  for (const where of [cycle, deep]) {
    statements = 0;
    await assert.rejects(
      async () => gtfs.schedule.stopTimes.where(where as never).count(),
      {
        code: 'GTFS_QUERY_INVALID',
      },
    );
    assert.equal(statements, 0);
  }
  assert.throws(
    () =>
      compileRepositoryFilters({
        dialect: 'sqlite',
        table: compiledTableRegistry.alerts,
        where: {
          image: { gt: '{}' },
        },
      }),
    { code: 'GTFS_QUERY_INVALID' },
  );
});
test('time filters report missing generated columns, including in nested GeoJSON filters', async () => {
  const other = new Gtfs({
    database: {},
    reporting: { level: 'silent' },
  });
  try {
    await other.schema.ensure();
    await other.database.withKysely({
      callback: async (database) => {
        await database.schema
          .dropIndex('idx_stop_times_stop_id_arrival_service_day_seconds')
          .execute();
        await database.schema
          .alterTable('stop_times')
          .dropColumn('arrival_service_day_seconds')
          .execute();
      },
    });
    await assert.rejects(
      () =>
        other.geojson.stops({
          sqlWhere: (eb) =>
            eb.exists(
              eb
                .selectFrom('stop_times as selected_time')
                .select('selected_time.trip_id')
                .whereRef('selected_time.source_id', '=', 'stops.source_id')
                .whereRef('selected_time.stop_id', '=', 'stops.stop_id')
                .where(
                  'selected_time.arrival_service_day_seconds',
                  '>=',
                  32400,
                ),
            ),
        }),
      /arrival_service_day_seconds/u,
    );
    for (const run of [
      () =>
        other.schedule.stopTimes.where({ arrival_time: '09:00:00' }).count(),
    ]) {
      await assert.rejects(
        async () => run(),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, 'GTFS_SCHEMA_INVALID');
          assert.match(
            JSON.stringify(error.details),
            /arrival_service_day_seconds/,
          );
          return true;
        },
      );
    }
    assert.equal(
      await other.schedule.stopTimes.where({ arrival_time: null }).count(),
      0,
    );
  } finally {
    await other.close();
  }
});
test('compiled time equality keeps the indexed storage column bare', async () => {
  const filters = compileRepositoryFilters({
    dialect: 'sqlite',
    table: compiledTableRegistry.stopTimes,
    where: {
      stop_id: 'platform',
      arrival_time: '09:00:00',
    },
  });
  const plan = await gtfs.database.withKysely({
    callback: (database) =>
      sql<{
        detail: string;
      }>`explain query plan select trip_id from stop_times where ${sql.join(filters.additionalWhere, sql` and `)}`.execute(
        database,
      ),
  });
  assert.ok(
    plan.rows.some(({ detail }) =>
      detail.includes('idx_stop_times_stop_id_arrival_service_day_seconds'),
    ),
  );
});
