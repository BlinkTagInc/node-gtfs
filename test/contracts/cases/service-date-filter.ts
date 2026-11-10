import assert from 'node:assert/strict';
import {
  sql,
  Kysely,
  type ExpressionBuilder,
  type Expression,
  type SqlBool,
} from 'kysely';
import type { GtfsDatabase } from '../../../src/schema/index.ts';
import { activeTripKeys } from '../../helpers/advanced-filter-recipes.ts';
import {
  integerText,
  safeInteger,
} from '../../helpers/advanced-summary-recipes.ts';
import { Gtfs, type GtfsDatabaseConfig } from '../../../src/index.ts';

export async function verifyServiceDateFilters(
  database: GtfsDatabaseConfig,
): Promise<void> {
  const gtfs = new Gtfs({ database, reporting: { level: 'silent' } });
  try {
    await gtfs.schema.recreate();
    const ids = [
      'added',
      'daily',
      'inactive',
      'late',
      'missing',
      'remote',
      'removed',
    ];
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const sourceId of ['north', 'south']) {
          for (const id of ids) {
            await sql`insert into routes (source_id, route_id, route_type)
              values (${sourceId}, ${id}, 3)`.execute(db);
            await sql`insert into trips (source_id, trip_id, route_id, service_id)
              values (${sourceId}, ${id}, ${id}, ${id})`.execute(db);
            await db
              .insertInto('stop_times')
              .values({
                source_id: sourceId,
                trip_id: id,
                stop_sequence: 1,
                arrival_time: '08:00:00',
                departure_time: id === 'late' ? '10:01:00' : '08:01:00',
                ...(database.client instanceof Kysely
                  ? {
                      arrival_service_day_seconds: 28800,
                      departure_service_day_seconds:
                        id === 'late' ? 36060 : 28860,
                    }
                  : {}),
              })
              .execute();
          }
        }
        await sql`insert into stop_times (source_id, trip_id, stop_sequence)
          values ('north', 'orphan', 1)`.execute(db);
        await sql`insert into calendar
          (source_id, service_id, monday, tuesday, wednesday, thursday, friday,
           saturday, sunday, start_date, end_date)
          values
            ('north', 'daily', 1, 1, 1, 1, 1, 0, 0, 20260824, 20260828),
            ('north', 'late', 1, 1, 1, 1, 1, 0, 0, 20260824, 20260828),
            ('north', 'removed', 1, 1, 1, 1, 1, 0, 0, 20260824, 20260828),
            ('north', 'inactive', 0, 0, 0, 0, 0, 0, 0, 20260824, 20260828),
            ('south', 'daily', 1, 1, 1, 1, 1, 0, 0, 20260824, 20260828)
          `.execute(db);
        await sql`insert into calendar_dates (source_id, service_id, date, exception_type)
          values
            ('north', 'daily', 20260826, 1),
            ('north', 'added', 20260826, 1),
            ('north', 'removed', 20260826, 2),
            ('south', 'daily', 20260826, 2),
            ('south', 'remote', 20260826, 1)`.execute(db);
      },
    });
    const active = ['added', 'daily', 'late'];
    const inactive = ids.filter((id) => !active.includes(id));
    await gtfs.database.withKysely({
      callback: async (db) => {
        type TripExpression = ExpressionBuilder<GtfsDatabase, 'trips'>;
        const activeOn = (eb: TripExpression, date: number) =>
          eb.exists(
            eb
              .selectFrom(activeTripKeys(db, date).as('active'))
              .select('active.trip_id')
              .whereRef('active.source_id', '=', 'trips.source_id')
              .whereRef('active.trip_id', '=', 'trips.trip_id'),
          );
        const cases: readonly [
          (eb: TripExpression) => Expression<SqlBool>,
          readonly string[],
        ][] = [
          [(eb) => activeOn(eb, 20260826), active],
          [(eb) => eb.not(activeOn(eb, 20260826)), inactive],
          [(eb) => eb.not(eb.not(activeOn(eb, 20260826))), active],
          [
            (eb) =>
              eb.or([activeOn(eb, 20260826), eb('trip_id', '=', 'missing')]),
            [...active, 'missing'],
          ],
          [
            (eb) => eb.and([activeOn(eb, 20260826), activeOn(eb, 20260825)]),
            ['daily', 'late'],
          ],
          [
            (eb) =>
              eb.and([
                activeOn(eb, 20260826),
                eb.not(eb('trip_id', '=', 'late')),
              ]),
            ['added', 'daily'],
          ],
          [(eb) => activeOn(eb, 20260823), []],
          [(eb) => activeOn(eb, 20260824), ['daily', 'late', 'removed']],
          [(eb) => activeOn(eb, 20260828), ['daily', 'late', 'removed']],
          [(eb) => activeOn(eb, 20260829), []],
        ];
        for (const [where, expected] of cases) {
          const matchingTrips = db
            .selectFrom('trips')
            .where('source_id', '=', 'north')
            .where(where);
          const tripQuery = matchingTrips.select('trip_id').orderBy('trip_id');
          const stopQuery = db
            .selectFrom('stop_times')
            .where('source_id', '=', 'north')
            .where((eb) =>
              eb.exists(
                eb
                  .selectFrom(
                    matchingTrips
                      .select(['source_id', 'trip_id'])
                      .as('matching'),
                  )
                  .select('matching.trip_id')
                  .whereRef('matching.source_id', '=', 'stop_times.source_id')
                  .whereRef('matching.trip_id', '=', 'stop_times.trip_id'),
              ),
            )
            .select('trip_id')
            .orderBy('trip_id');
          const rows = expected.map((trip_id) => ({ trip_id }));
          for (const query of [tripQuery, stopQuery]) {
            assert.deepEqual(await query.execute(), rows);
            assert.deepEqual(
              (await query.executeTakeFirst()) ?? null,
              rows[0] ?? null,
            );
            const count = await db
              .selectFrom(query.as('matches'))
              .select((eb) =>
                integerText(eb.fn.countAll(), gtfs.database.dialect).as(
                  'total',
                ),
              )
              .executeTakeFirstOrThrow();
            assert.equal(safeInteger(count.total), rows.length);
          }
          assert.deepEqual(
            await db
              .selectFrom('routes')
              .where('source_id', '=', 'north')
              .where((eb) =>
                eb.exists(
                  eb
                    .selectFrom(
                      matchingTrips
                        .select(['source_id', 'route_id'])
                        .as('matching'),
                    )
                    .select('matching.route_id')
                    .whereRef('matching.source_id', '=', 'routes.source_id')
                    .whereRef('matching.route_id', '=', 'routes.route_id'),
                ),
              )
              .select('route_id')
              .orderBy('route_id')
              .execute(),
            expected.map((route_id) => ({ route_id })),
          );
        }
        const activeStopTimes = db
          .selectFrom('stop_times')
          .where((eb) =>
            eb.exists(
              eb
                .selectFrom(activeTripKeys(db, 20260826).as('active'))
                .select('active.trip_id')
                .whereRef('active.source_id', '=', 'stop_times.source_id')
                .whereRef('active.trip_id', '=', 'stop_times.trip_id'),
            ),
          );
        assert.deepEqual(
          await activeStopTimes
            .where('arrival_service_day_seconds', '>=', 25200)
            .where('departure_service_day_seconds', '<=', 36000)
            .select(['source_id', 'trip_id'])
            .orderBy('source_id')
            .orderBy('trip_id')
            .execute(),
          [
            { source_id: 'north', trip_id: 'added' },
            { source_id: 'north', trip_id: 'daily' },
            { source_id: 'south', trip_id: 'remote' },
          ],
        );
        assert.deepEqual(
          await db
            .selectFrom('stop_times')
            .where('source_id', '=', 'north')
            .where('trip_id', '=', 'orphan')
            .where((eb) =>
              eb.not(
                eb.exists(
                  eb
                    .selectFrom(activeTripKeys(db, 20260826).as('active'))
                    .select('active.trip_id')
                    .whereRef('active.source_id', '=', 'stop_times.source_id')
                    .whereRef('active.trip_id', '=', 'stop_times.trip_id'),
                ),
              ),
            )
            .select('trip_id')
            .execute(),
          [{ trip_id: 'orphan' }],
        );
        assert.deepEqual(
          await db
            .selectFrom('routes')
            .where('source_id', '=', 'north')
            .where((eb) =>
              eb.exists(
                eb
                  .selectFrom('trips')
                  .select('trips.trip_id')
                  .whereRef('trips.source_id', '=', 'routes.source_id')
                  .whereRef('trips.route_id', '=', 'routes.route_id')
                  .where((trip) =>
                    trip.exists(
                      trip
                        .selectFrom(
                          activeStopTimes
                            .select(['source_id', 'trip_id'])
                            .as('active_time'),
                        )
                        .select('active_time.trip_id')
                        .whereRef(
                          'active_time.source_id',
                          '=',
                          'trips.source_id',
                        )
                        .whereRef('active_time.trip_id', '=', 'trips.trip_id'),
                    ),
                  ),
              ),
            )
            .select('route_id')
            .orderBy('route_id')
            .execute(),
          active.map((route_id) => ({ route_id })),
        );
      },
    });
    // Ordinary service-date queries keep the validated convenience API.
    assert.deepEqual(
      await gtfs.query
        .activeTrips({ serviceDate: 20260826 })
        .where({ source_id: 'north' })
        .select('trip_id')
        .orderBy([{ field: 'trip_id' }])
        .all(),
      active.map((trip_id) => ({ trip_id })),
    );
    const query = gtfs.schedule.trips
      .where({ source_id: 'north', serviceDate: 20260826 })
      .select('trip_id')
      .orderBy([{ field: 'trip_id', direction: 'asc' }]);
    assert.deepEqual(
      await query.all(),
      active.map((trip_id) => ({ trip_id })),
    );
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`delete from calendar_dates where source_id = 'north' and service_id = 'added'`.execute(
          db,
        );
      },
    });
    assert.deepEqual(
      await query.all(),
      ['daily', 'late'].map((trip_id) => ({ trip_id })),
    );
  } finally {
    await gtfs.close();
  }
}
