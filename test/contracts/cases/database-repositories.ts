import { compileActiveServiceCondition } from '../../../src/query/semantic-filters.ts';
import assert from 'node:assert/strict';
import { Kysely, sql } from 'kysely';
import { Gtfs, GtfsErrorCode } from '../../../src/index.ts';
import {
  createKyselyGtfsIndexes,
  createKyselyGtfsTables,
  type GtfsDatabaseDialect,
} from '../../../src/kysely.ts';
import type { ConformanceDatabase } from './database-types.ts';

export async function verifyExtensionRepositoryStateMatrix(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
  getQueryCount: () => number,
): Promise<void> {
  await createKyselyGtfsTables({
    database: db,
    dialect,
    mode: 'recreate',
    extensions: ['gtfs-ride'],
  });
  await createKyselyGtfsIndexes({
    database: db,
    dialect,
    mode: 'ensure',
    extensions: ['gtfs-ride'],
  });
  const gtfs = new Gtfs({
    database: { client: db },
    extensions: ['gtfs-ride'],
  });
  try {
    const queryCountBeforeDisabledRepository = getQueryCount();
    await assert.rejects(
      async () => gtfs.gtfsPlus.stopAttributes.all(),
      (error: unknown) => {
        const candidate = error as {
          code?: unknown;
          details?: Record<string, unknown>;
        };
        return (
          candidate.code === GtfsErrorCode.EXTENSION_DISABLED &&
          candidate.details?.table === 'stop_attributes' &&
          candidate.details?.extension === 'gtfs-plus' &&
          Array.isArray(candidate.details?.enabledExtensions)
        );
      },
    );
    assert.equal(getQueryCount(), queryCountBeforeDisabledRepository);
    assert.deepEqual(await gtfs.gtfsRide.rideFeedInfo.all(), []);
    assert.equal(await gtfs.gtfsRide.rideFeedInfo.first(), null);
    assert.equal(await gtfs.gtfsRide.rideFeedInfo.count(), 0);
    await db.schema.dropTable('ride_feed_info').execute();
    await assert.rejects(
      async () => gtfs.gtfsRide.rideFeedInfo.all(),
      (error: unknown) =>
        (
          error as {
            code?: unknown;
          }
        ).code === GtfsErrorCode.SCHEMA_INVALID,
    );
  } finally {
    await gtfs.close();
  }
}
export async function verifyRepositoryFilterIntegration(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
): Promise<void> {
  await createKyselyGtfsTables({
    database: db,
    dialect,
    mode: 'recreate',
  });
  await createKyselyGtfsIndexes({
    database: db,
    dialect,
    mode: 'ensure',
  });
  await sql`insert into routes
    (source_id, route_id, route_short_name, route_type)
    values
      ('north', 'red', 'Red', 3),
      ('north', 'late', 'Late', 3),
      ('north', 'inactive', 'Inactive', 3),
      ('south', 'red', 'Other source', 3)`.execute(db);
  await sql`insert into trips
    (source_id, route_id, service_id, trip_id)
    values
      ('north', 'red', 'weekday', 'red-trip'),
      ('north', 'late', 'weekday', 'late-trip'),
      ('north', 'inactive', 'inactive', 'inactive-trip'),
      ('south', 'red', 'weekday', 'red-trip')`.execute(db);
  await sql`insert into stop_times
    (source_id, trip_id, arrival_time, arrival_service_day_seconds, stop_id, stop_sequence)
    values
      ('north', 'red-trip', '09:00:00', 32400, 'red-stop', 1),
      ('north', 'red-trip', '09:00:00', 32400, 'red-stop', 2),
      ('north', 'late-trip', '11:00:00', 39600, 'late-stop', 1),
      ('north', 'inactive-trip', '09:00:00', 32400, 'inactive-stop', 1),
      ('south', 'red-trip', '09:00:00', 32400, 'red-stop', 1)`.execute(db);
  await sql`insert into calendar_dates
    (source_id, service_id, date, exception_type)
    values ('north', 'weekday', 20260826, 1)`.execute(db);
  await sql`insert into stops (source_id, stop_id, stop_name, stop_lat, stop_lon)
    values ('north', 'red-stop', 'Red stop', 10, 20),
      ('south', 'red-stop', 'Red stop', 10, 20)`.execute(db);
  await sql`insert into fare_attributes (source_id, fare_id, price, currency_type, payment_method)
    values ('north', 'fare', 124, 'USD', 0)`.execute(db);
  const gtfs = new Gtfs({
    database: { client: db },
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    assert.deepEqual(
      await gtfs.schedule.trips
        .where({ source_id: 'north', route_id: 'red', serviceDate: 20260826 })
        .select('trip_id')
        .all(),
      [{ trip_id: 'red-trip' }],
    );
    await sql`update routes set route_desc = 'description'
      where source_id = 'north' and route_id = 'red'`.execute(db);
    for (const [where, expected] of [
      [{}, ['inactive', 'late', 'red']],
      [{ route_desc: null }, ['inactive', 'late']],
      [{ route_id: 'red' }, ['red']],
      [{ source_id: 'south' }, []],
    ] as const) {
      const query = gtfs.schedule.routes
        .where(where)
        .select('route_id')
        .orderBy([{ field: 'route_id' }]);
      assert.deepEqual(
        await query.all(),
        expected.map((route_id) => ({ route_id })),
      );
      assert.deepEqual(
        await query.first(),
        expected[0] === undefined ? null : { route_id: expected[0] },
      );
      assert.equal(await query.count(), expected.length);
    }
    for (const options of [
      { where: undefined },
      { where: { route_desc: undefined } },
      { where: { route_desc: [null, undefined] } },
      { where: { trips: { some: { block_id: undefined } } } },
      { where: { trips: { some: { serviceDate: undefined } } } },
      { where: { OR: {} } },
      { where: { route_type: { gt: '3' } } },
      { where: { route_type: { gte: 1.5 } } },
      { where: { route_id: { in: [null] } } },
      { where: { route_id: ['red'] } },
      { where: { route_id: { contains: 3 } } },
      { where: { or: [] } },
    ]) {
      for (const method of ['all', 'first', 'count'] as const) {
        await assert.rejects(
          async () =>
            method === 'all'
              ? gtfs.schedule.routes.where(options.where as never).all()
              : method === 'first'
                ? gtfs.schedule.routes.where(options.where as never).first()
                : gtfs.schedule.routes.where(options.where as never).count(),
          {
            code: 'GTFS_QUERY_INVALID',
          },
        );
      }
    }
    assert.deepEqual(
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .selectFrom('fare_attributes')
            .where('source_id', '=', 'north')
            .where('currency_type', '=', 'USD')
            .where('price', '>', '123')
            .where('price', '<', '125')
            .select('fare_id')
            .execute(),
      }),
      [{ fare_id: 'fare' }],
    );
    const geojson = await gtfs.geojson.stops({
      sqlWhere: (eb) =>
        eb.and([
          eb('stops.stop_lat', '>=', 0),
          eb.exists(
            eb
              .selectFrom('stop_times as selected_time')
              .innerJoin('trips as selected_trip', (join) =>
                join
                  .onRef(
                    'selected_trip.source_id',
                    '=',
                    'selected_time.source_id',
                  )
                  .onRef('selected_trip.trip_id', '=', 'selected_time.trip_id'),
              )
              .select('selected_time.trip_id')
              .whereRef('selected_time.source_id', '=', 'stops.source_id')
              .whereRef('selected_time.stop_id', '=', 'stops.stop_id')
              .where('selected_time.arrival_service_day_seconds', '>=', 32400)
              .where('selected_time.arrival_service_day_seconds', '<=', 32400)
              .where(compileActiveServiceCondition('selected_trip', 20260826)),
          ),
        ]),
    });
    assert.deepEqual(
      geojson.features.map(({ properties }) => [
        properties.source_id,
        properties.stop_id,
      ]),
      [['north', 'red-stop']],
    );
    await assert.rejects(
      async () => gtfs.schedule.calendarDates.where({ date: 20260229 }).count(),
      { code: 'GTFS_QUERY_INVALID' },
    );
  } finally {
    await gtfs.close();
  }
}
