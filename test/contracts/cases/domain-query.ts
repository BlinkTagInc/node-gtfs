import assert from 'node:assert/strict';
import { Kysely, sql } from 'kysely';
import { Gtfs, type GtfsDatabaseConfig } from '../../../src/index.ts';

export async function verifyDomainQueries(
  database: GtfsDatabaseConfig,
): Promise<void> {
  const gtfs = new Gtfs({ database, reporting: { level: 'silent' } });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const source of ['north', 'south']) {
          for (const [id, type, parent, lat, lon] of [
            ['parent', 1, null, 46, -122],
            ['platform', 0, 'parent', 45, -122],
            ['sibling', null, 'parent', 45, -122],
            ['boarding', 4, 'platform', 45, -122],
            ['entrance', 2, 'parent', 45, -122],
            ['node', 3, 'parent', 45, -122],
            ['orphan', 0, 'missing', 45, -122],
            ['invalid-parent', 1, null, null, null],
            ['invalid-child', 0, 'invalid-parent', 45, -122],
            ['standalone', null, '', 45, -122],
            ['east', 0, null, 0, 179],
            ['west', 0, null, 0, -179],
            ['foreign', 0, null, 45, -122],
          ] as const) {
            await sql`insert into stops (source_id, stop_id, location_type, parent_station, stop_lat, stop_lon)
            values (${source}, ${id}, ${type}, ${parent}, ${lat}, ${lon})`.execute(
              db,
            );
          }
          for (const [id, route, service] of [
            ['daily', 'red', 'daily'],
            ['duplicate', 'red', 'daily'],
            ['added', 'red', 'added'],
            ['removed', 'red', 'removed'],
            ['inactive', 'blue', 'inactive'],
            ['foreign', source === 'north' ? 'blue' : 'red', 'daily'],
          ]) {
            await sql`insert into trips (source_id, trip_id, route_id, service_id)
            values (${source}, ${id}, ${route}, ${service})`.execute(db);
          }
          const stops = [
            'platform',
            'sibling',
            'boarding',
            'entrance',
            'node',
            'orphan',
            'invalid-child',
            'standalone',
          ];
          for (const [index, stop] of stops.entries()) {
            const time =
              index === 0
                ? '25:00:00'
                : index === 1
                  ? '25:30:00'
                  : index === 2
                    ? '100:00:00'
                    : null;
            const seconds =
              index === 0
                ? 90000
                : index === 1
                  ? 91800
                  : index === 2
                    ? 360000
                    : null;
            await db
              .insertInto('stop_times')
              .values({
                source_id: source,
                trip_id: 'daily',
                stop_sequence: index + 1,
                stop_id: stop,
                arrival_time: time,
                departure_time: '26:00:00',
                ...(!(database.client instanceof Kysely)
                  ? {}
                  : {
                      arrival_service_day_seconds: seconds,
                      departure_service_day_seconds: 93600,
                    }),
              })
              .execute();
          }
          await sql`insert into stop_times (source_id, trip_id, stop_sequence, stop_id)
          values (${source}, 'duplicate', 1, 'platform'),
                 (${source}, 'added', 1, 'east'),
                 (${source}, 'removed', 1, 'west'),
                 (${source}, 'foreign', 1, 'foreign')`.execute(db);
          await sql`insert into calendar (source_id, service_id, monday, tuesday, wednesday, thursday, friday,
          saturday, sunday, start_date, end_date)
          values (${source}, 'daily', 1, 1, 1, 1, 1, 0, 0, 20260921, 20260925),
                 (${source}, 'removed', 1, 1, 1, 1, 1, 1, 1, 20260921, 20260925)`.execute(
            db,
          );
          await sql`insert into calendar_dates (source_id, service_id, date, exception_type)
          values (${source}, 'removed', 20260922, 2)`.execute(db);
        }
        await sql`insert into calendar_dates (source_id, service_id, date, exception_type)
        values ('north', 'added', 20260922, 1), ('south', 'daily', 20260922, 2)`.execute(
          db,
        );
      },
    });
    const active = gtfs.query.activeTrips({
      serviceDate: 20260922,
      routeId: 'red',
    });
    assert.deepEqual(
      await active
        .select('source_id', 'trip_id')
        .orderBy([{ field: 'trip_id' }])
        .all(),
      [
        { source_id: 'north', trip_id: 'added' },
        { source_id: 'north', trip_id: 'daily' },
        { source_id: 'north', trip_id: 'duplicate' },
      ],
    );
    assert.equal(await active.count(), 3);
    const order = [
      { field: 'trip_id' as const, direction: 'asc' as 'asc' | 'desc' },
    ];
    const ordered = active.orderBy(order);
    order[0]!.direction = 'desc';
    assert.equal((await ordered.first())?.trip_id, 'added');
    assert.equal(await active.select('route_id').count(), 3);
    assert.equal(
      await active
        .orderBy([{ field: 'trip_id' }])
        .offset(1)
        .limit(1)
        .count(),
      1,
    );
    assert.equal(await active.offset(99).count(), 0);
    assert.equal(await active.limit(0).count(), 0);
    assert.equal(await active.limit(0).first(), null);
    assert.equal(
      (
        await active
          .orderBy([{ field: 'trip_id' }])
          .offset(1)
          .first()
      )?.trip_id,
      'daily',
    );
    assert.equal(await active.where({ source_id: 'south' }).count(), 0);
    assert.equal(
      await gtfs.query.activeTrips({ serviceDate: 20260926 }).count(),
      0,
    );
    assert.equal(
      await gtfs.query.activeTrips({ serviceDate: 20260920 }).count(),
      0,
    );

    const window = gtfs.query.stopTimes({
      serviceDate: 20260922,
      routeId: 'red',
      window: { field: 'arrival_time', start: '25:00:00', end: '25:30:00' },
    });
    assert.deepEqual(
      await window.select('source_id', 'stop_id', 'arrival_time').all(),
      [{ source_id: 'north', stop_id: 'platform', arrival_time: '25:00:00' }],
    );
    assert.equal(
      await gtfs.query
        .stopTimes({
          serviceDate: 20260922,
          routeId: 'red',
          stopId: 'boarding',
          window: {
            field: 'arrival_time',
            start: '99:00:00',
            end: '101:00:00',
          },
        })
        .count(),
      1,
    );
    assert.equal(
      await gtfs.query
        .stopTimes({
          serviceDate: 20260922,
          window: { field: 'arrival_time', start: '25:00:00', end: '25:00:00' },
        })
        .count(),
      0,
    );
    assert.equal(
      await gtfs.query
        .stopTimes({
          serviceDate: 20260922,
          routeId: 'red',
          window: {
            field: 'departure_time',
            start: '26:00:00',
            end: '26:00:01',
          },
        })
        .count(),
      8,
    );
    assert.equal(
      await gtfs.query
        .stopTimes({ serviceDate: 20260922, routeId: 'red', stopId: 'foreign' })
        .count(),
      0,
    );

    const routeParents = gtfs.query.stopsForRoute({
      routeId: 'red',
      serviceDate: 20260922,
      useParentStation: true,
    });
    assert.deepEqual(
      await routeParents
        .select('source_id', 'stop_id')
        .orderBy([{ field: 'stop_id' }])
        .all(),
      [
        { source_id: 'north', stop_id: 'east' },
        { source_id: 'north', stop_id: 'parent' },
        { source_id: 'north', stop_id: 'standalone' },
      ],
    );
    assert.equal(await routeParents.count(), 3);
    assert.equal(await routeParents.where({ stop_id: 'platform' }).count(), 0);
    assert.equal(await routeParents.where({ stop_id: 'parent' }).count(), 1);
    assert.equal(
      await routeParents
        .orderBy([{ field: 'stop_id' }])
        .offset(1)
        .limit(1)
        .count(),
      1,
    );
    assert.equal(
      (
        await routeParents
          .orderBy([{ field: 'stop_id' }])
          .offset(1)
          .first()
      )?.stop_id,
      'parent',
    );
    assert.equal(
      await gtfs.query
        .stopsForRoute({ routeId: 'red', serviceDate: 20260922 })
        .count(),
      9,
    );
    assert.equal(
      await gtfs.query
        .stopsForRoute({ routeId: 'red' })
        .where({ source_id: 'north', stop_id: 'foreign' })
        .count(),
      0,
    );
    assert.equal(
      await gtfs.query
        .stopsForRoute({ routeId: 'red' })
        .where({ source_id: 'south', stop_id: 'foreign' })
        .count(),
      1,
    );
    assert.equal(
      await gtfs.query.stopsForRoute({ routeId: "red' OR 1=1 --" }).count(),
      0,
    );

    const bounds = { south: 44, north: 45.5, west: -123, east: -121 };
    const parents = gtfs.query.stops({
      withinBounds: bounds,
      useParentStation: true,
    });
    // The parent lies outside the bounds, but its qualifying platform is inside.
    assert.deepEqual(
      await parents
        .where({ stop_id: 'parent' })
        .select('source_id')
        .orderBy([{ field: 'source_id' }])
        .all(),
      [{ source_id: 'north' }, { source_id: 'south' }],
    );
    assert.equal(
      await parents
        .where({ withinBounds: bounds })
        .where({ stop_id: 'parent' })
        .count(),
      0,
    );
    assert.equal(
      await gtfs.query
        .stops({ withinBounds: { south: -1, north: 1, west: 178, east: -178 } })
        .count(),
      4,
    );
    assert.equal(
      await gtfs.query.stops().where({ location_type: 1 }).count(),
      0,
    );
    assert.equal(
      await gtfs.schedule.stops.where({ location_type: 1 }).count(),
      4,
    );
    for (const useParentStation of [false, true]) {
      const rows = await gtfs.query.stops({ useParentStation }).all();
      const features = await gtfs.geojson.stops({ useParentStation });
      const ids = rows
        .filter((row) => row.stop_lat !== null && row.stop_lon !== null)
        .map((row) => `${row.source_id}/${row.stop_id}`)
        .sort();
      assert.deepEqual(
        ids,
        features.features
          .map(
            (feature) =>
              `${feature.properties.source_id}/${feature.properties.stop_id}`,
          )
          .sort(),
      );
    }
    const streamed: string[] = [];
    for await (const row of routeParents
      .orderBy([{ field: 'stop_id' }])
      .stream()) {
      streamed.push(row.stop_id);
      break;
    }
    assert.deepEqual(streamed, ['east']);
    assert.equal(await routeParents.count(), 3);

    await gtfs.database.withKysely({
      callback: async (client) => {
        const scoped = new Gtfs({
          database: { client },
          sources: [{ sourceId: 'north' }],
          reporting: { level: 'silent' },
        });
        try {
          assert.equal(
            await scoped.query
              .stopsForRoute({ routeId: 'red' })
              .where({ source_id: 'south' })
              .count(),
            0,
          );
          assert.equal(
            await scoped.query
              .stops({ useParentStation: true })
              .where({ source_id: 'south' })
              .count(),
            0,
          );
          assert.equal(
            await scoped.query.stops().where({ source_id: 'south' }).count(),
            0,
          );
          assert.equal(
            await scoped.query
              .activeTrips({ serviceDate: 20260922 })
              .where({ source_id: 'south' })
              .count(),
            0,
          );
          assert.equal(
            await scoped.query
              .stopTimes({ serviceDate: 20260922 })
              .where({ source_id: 'south' })
              .count(),
            0,
          );
        } finally {
          await scoped.close();
        }
      },
    });
  } finally {
    await gtfs.close();
  }
}
