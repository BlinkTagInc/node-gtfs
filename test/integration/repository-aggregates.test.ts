import { sql } from 'kysely';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Database from 'better-sqlite3';
import { Gtfs, isGtfsError } from '../../src/index.ts';
import {
  integerText,
  safeInteger,
} from '../helpers/advanced-summary-recipes.ts';
let statements = 0;
const sqlite = new Database(':memory:', {
  verbose() {
    statements += 1;
  },
});
const database = { client: sqlite } as const;
const gtfs = new Gtfs({
  database,
  sources: [{ sourceId: 'north' }],
  reporting: { level: 'silent' },
});
before(async () => {
  await gtfs.schema.ensure();
  sqlite.exec(`
    INSERT INTO trips (source_id, trip_id, route_id, service_id, direction_id) VALUES
      ('north', 'a', 'red', 'weekday', 0), ('north', 'b', 'red', 'weekday', 1),
      ('north', 'c', 'blue', 'weekend', NULL), ('south', 'a', 'red', 'weekday', 0);
    INSERT INTO routes (source_id, route_id, route_type) VALUES
      ('north', 'red', 3), ('north', 'blue', 2), ('south', 'red', 3);
    INSERT INTO calendar_dates (source_id, service_id, date, exception_type) VALUES ('north', 'weekday', 20260912, 1);
    INSERT INTO stop_times (source_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time) VALUES
      ('north', 'a', 1, 'one', '9:00:00', '10:00:00'),
      ('north', 'a', 2, 'two', '100:00:00', '100:00:00'),
      ('north', 'b', 1, 'one', '25:00:00', '24:00:00'),
      ('north', 'c', 1, 'one', NULL, '20:00:00'),
      ('south', 'a', 1, 'one', '01:00:00', '02:00:00');
    INSERT INTO stops (source_id, stop_id, stop_name, stop_desc, stop_lat, stop_lon, _node_gtfs_casefold_stop_name, _node_gtfs_casefold_stop_desc) VALUES
      ('north', 'one', 'Straße', 'STRASSE', 1, 2, 'strasse', 'strasse'),
      ('north', 'two', 'Other', NULL, 2, 1, 'other', NULL);
  `);
});
after(async () => {
  await gtfs.close();
  sqlite.close();
});
test('SQL field comparisons preserve numeric times, nulls, related rows and counts', async () => {
  await gtfs.database.withKysely({
    callback: async (db) => {
      const times = db
        .selectFrom('stop_times')
        .where('source_id', '=', 'north');
      const positive = times.whereRef(
        'departure_service_day_seconds',
        '>',
        'arrival_service_day_seconds',
      );
      assert.deepEqual(await positive.select('trip_id').execute(), [
        { trip_id: 'a' },
      ]);
      assert.equal(
        (await positive.select('stop_sequence').executeTakeFirstOrThrow())
          .stop_sequence,
        1,
      );
      const total = await positive
        .select((eb) => integerText(eb.fn.countAll(), 'sqlite').as('total'))
        .executeTakeFirstOrThrow();
      assert.equal(safeInteger(total.total), 1);
      assert.deepEqual(
        await times
          .whereRef(
            'departure_service_day_seconds',
            '!=',
            'arrival_service_day_seconds',
          )
          .select('trip_id')
          .orderBy('trip_id')
          .execute(),
        [{ trip_id: 'a' }, { trip_id: 'b' }],
      );
      assert.deepEqual(
        await times
          .whereRef(
            'departure_service_day_seconds',
            '>=',
            'arrival_service_day_seconds',
          )
          .whereRef(
            'departure_service_day_seconds',
            '<=',
            'arrival_service_day_seconds',
          )
          .select(['trip_id', 'stop_sequence'])
          .execute(),
        [{ trip_id: 'a', stop_sequence: 2 }],
      );
      // NOT comparisons still exclude nulls, rather than treating them as unequal.
      assert.deepEqual(
        await times
          .where((eb) =>
            eb.not(
              eb(
                'departure_service_day_seconds',
                '>',
                eb.ref('arrival_service_day_seconds'),
              ),
            ),
          )
          .select(['trip_id', 'stop_sequence'])
          .orderBy('trip_id')
          .execute(),
        [
          { trip_id: 'a', stop_sequence: 2 },
          { trip_id: 'b', stop_sequence: 1 },
        ],
      );
      const servingTrips = db
        .selectFrom('trips')
        .where('source_id', '=', 'north')
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('stop_times')
              .select('trip_id')
              .whereRef('stop_times.source_id', '=', 'trips.source_id')
              .whereRef('stop_times.trip_id', '=', 'trips.trip_id')
              .whereRef(
                'departure_service_day_seconds',
                '>',
                'arrival_service_day_seconds',
              ),
          ),
        );
      const grouped = await servingTrips
        .select('route_id')
        .select((eb) => integerText(eb.fn.countAll(), 'sqlite').as('total'))
        .groupBy('route_id')
        .execute();
      assert.deepEqual(
        grouped.map((row) => ({ ...row, total: safeInteger(row.total) })),
        [{ route_id: 'red', total: 1 }],
      );
      assert.deepEqual(
        await db
          .selectFrom('trips')
          .where('source_id', '=', 'north')
          .where((eb) =>
            eb.exists(
              eb
                .selectFrom('stop_times')
                .select('trip_id')
                .whereRef('stop_times.source_id', '=', 'trips.source_id')
                .whereRef('stop_times.trip_id', '=', 'trips.trip_id')
                .whereRef(
                  'departure_service_day_seconds',
                  '<',
                  'arrival_service_day_seconds',
                ),
            ),
          )
          .select('trip_id')
          .execute(),
        [{ trip_id: 'b' }],
      );
      const stops = db
        .selectFrom('stops')
        .where('source_id', '=', 'north')
        .select('stop_id');
      assert.deepEqual(
        await stops.whereRef('stop_lat', '<', 'stop_lon').execute(),
        [{ stop_id: 'one' }],
      );
      assert.deepEqual(
        await stops.whereRef('stop_name', '=', 'stop_desc').execute(),
        [],
      );
      assert.deepEqual(
        await stops
          .where(
            sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} = ${sql.ref('stops._node_gtfs_casefold_stop_desc')}`,
          )
          .execute(),
        [{ stop_id: 'one' }],
      );
    },
  });
  assert.equal(
    (
      await gtfs.geojson.stops({
        sqlWhere: (eb) => eb('stops.stop_lat', '<', eb.ref('stops.stop_lon')),
      })
    ).features.length,
    1,
  );
});
test('disabled repositories remain discoverable and reject counts before SQL', async () => {
  assert(Object.isFrozen(gtfs.gtfsPlus.directions));
  const before = statements;
  await assert.rejects(() => gtfs.gtfsPlus.directions.count(), {
    code: 'GTFS_EXTENSION_DISABLED',
  });
  assert.equal(statements, before);
});

test('SQL field counts include empty strings and support JSON, money, dates and real extrema', async () => {
  sqlite.exec("UPDATE stops SET stop_desc = '' WHERE stop_id = 'two'");
  try {
    await gtfs.database.withKysely({
      callback: async (db) => {
        const locations = await db
          .selectFrom('locations')
          .where('source_id', '=', 'north')
          .select((eb) =>
            integerText(eb.fn.count('geometry'), 'sqlite').as('total'),
          )
          .executeTakeFirstOrThrow();
        const fares = await db
          .selectFrom('fare_products')
          .where('source_id', '=', 'north')
          .select((eb) =>
            integerText(eb.fn.count('amount'), 'sqlite').as('total'),
          )
          .executeTakeFirstOrThrow();
        assert.equal(safeInteger(locations.total), 0);
        assert.equal(safeInteger(fares.total), 0);
        const stops = await db
          .selectFrom('stops')
          .where('source_id', '=', 'north')
          .select((eb) => [
            integerText(eb.fn.count('stop_desc'), 'sqlite').as('total'),
            eb.fn.min('stop_lat').as('latitude'),
            eb.fn.max('stop_lon').as('longitude'),
          ])
          .executeTakeFirstOrThrow();
        assert.deepEqual(
          { ...stops, total: safeInteger(stops.total) },
          { total: 2, latitude: 1, longitude: 2 },
        );
        const dates = await db
          .selectFrom('calendar_dates')
          .where('source_id', '=', 'north')
          .select((eb) => [
            integerText(eb.fn.min('date'), 'sqlite').as('first'),
            integerText(eb.fn.max('date'), 'sqlite').as('last'),
          ])
          .executeTakeFirstOrThrow();
        assert.deepEqual(
          { first: safeInteger(dates.first), last: safeInteger(dates.last) },
          { first: 20260912, last: 20260912 },
        );
      },
    });
  } finally {
    sqlite.exec("UPDATE stops SET stop_desc = NULL WHERE stop_id = 'two'");
  }
  assert.deepEqual(
    await gtfs.database.withKysely({
      callback: (db) =>
        db
          .selectFrom('calendar_dates')
          .where('source_id', '=', 'north')
          .whereRef('date', '=', 'date')
          .select('date')
          .execute(),
    }),
    [{ date: 20260912 }],
  );
});

test('SQL field comparisons report database drift while reader count preflight stays projection independent', async () => {
  sqlite.exec(
    'ALTER TABLE stop_times RENAME COLUMN departure_service_day_seconds TO missing_seconds',
  );
  try {
    await assert.rejects(
      () =>
        gtfs.database.withKysely({
          callback: (db) =>
            db
              .selectFrom('stop_times')
              .where('source_id', '=', 'north')
              .whereRef(
                'arrival_service_day_seconds',
                '<',
                'departure_service_day_seconds',
              )
              .select('trip_id')
              .execute(),
        }),
      (error) => error instanceof Error && !isGtfsError(error),
    );
    assert.equal(await gtfs.schedule.stopTimes.count(), 4);
  } finally {
    sqlite.exec(
      'ALTER TABLE stop_times RENAME COLUMN missing_seconds TO departure_service_day_seconds',
    );
  }
  sqlite.exec('DROP TABLE agency');
  await assert.rejects(() => gtfs.schedule.agency.count(), {
    code: 'GTFS_SCHEMA_INVALID',
  });
});

test('SQL integer extrema and grouping retain exact text for application validation', async () => {
  sqlite.exec(
    "INSERT INTO stop_times (source_id, trip_id, stop_sequence, stop_id) VALUES ('north', 'huge', 9007199254740993, 'one')",
  );
  await gtfs.database.withKysely({
    callback: async (db) => {
      const maximum = await db
        .selectFrom('stop_times')
        .where('source_id', '=', 'north')
        .select((eb) =>
          integerText(eb.fn.max('stop_sequence'), 'sqlite').as('value'),
        )
        .executeTakeFirstOrThrow();
      assert.equal(maximum.value, '9007199254740993');
      assert.throws(() => safeInteger(maximum.value), RangeError);
      const groups = await db
        .selectFrom('stop_times')
        .where('source_id', '=', 'north')
        .select((eb) =>
          integerText(eb.ref('stop_sequence'), 'sqlite').as('value'),
        )
        .groupBy('stop_sequence')
        .orderBy('stop_sequence')
        .execute();
      assert.equal(groups.at(-1)?.value, '9007199254740993');
      assert.throws(
        () => groups.map((row) => safeInteger(row.value)),
        RangeError,
      );
    },
  });
});
