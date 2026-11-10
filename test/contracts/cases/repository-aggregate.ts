import {
  integerText,
  safeInteger,
} from '../../helpers/advanced-summary-recipes.ts';
import {
  activeTripKeys,
  departuresAfterArrival,
} from '../../helpers/advanced-filter-recipes.ts';
import { verifyAdvancedSummaries } from './advanced-summary.ts';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import {
  Gtfs,
  importGtfs,
  isGtfsError,
  type GtfsImportOptions,
} from '../../../src/index.ts';
export async function verifyAggregateAndFieldReferenceIntegration(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-aggregate-integration-'),
  );
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  const allSources = new Gtfs({ database, reporting: { level: 'silent' } });
  try {
    await gtfs.schema.recreate();
    const files = {
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\na,Transit,https://example.com,Etc/UTC\n',
      'routes.txt':
        'route_id,route_type,route_short_name,route_long_name\nred,3,Straße,STRASSE\n',
      'trips.txt':
        'trip_id,route_id,service_id,direction_id\na,red,weekday,0\nb,red,weekday,1\nc,red,weekend,\n',
      'calendar_dates.txt':
        'service_id,date,exception_type\nweekday,20260912,1\n',
      'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\none,Station,1,2\n',
      'stop_times.txt':
        'trip_id,stop_sequence,stop_id,arrival_time,departure_time\na,1,one,9:00:00,10:00:00\nb,1,one,100:00:00,99:00:00\nc,1,one,,\n',
      'shapes.txt':
        'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n' +
        Array.from(
          { length: 2105 },
          (_, index) => `line,1,2,${index + 1},${index / 4}\n`,
        ).join(''),
    };
    for (const [filename, contents] of Object.entries(files)) {
      await writeFile(path.join(directory, filename), contents);
    }
    await importGtfs({
      database,
      sources: ['north', 'south'].map((sourceId) => ({
        sourceId,
        schedule: {
          path: directory,
          import: { validation: { mode: 'permissive' } },
        },
      })),
      reporting: { level: 'silent' },
    });
    await verifyAdvancedSummaries(gtfs);
    await gtfs.database.withKysely({
      callback: async (db) => {
        assert.deepEqual(await departuresAfterArrival(db, 'north').execute(), [
          {
            trip_id: 'a',
            arrival_time: '09:00:00',
            departure_time: '10:00:00',
          },
        ]);
        assert.deepEqual(
          await db
            .selectFrom('stop_times')
            .where('source_id', '=', 'north')
            .where('arrival_service_day_seconds', '>=', 86400)
            .where('arrival_service_day_seconds', '<', 360001)
            .select('trip_id')
            .execute(),
          [{ trip_id: 'b' }],
        );
        assert.deepEqual(
          await db
            .selectFrom('stop_times')
            .where('source_id', '=', 'north')
            .whereRef(
              'arrival_service_day_seconds',
              '!=',
              'departure_service_day_seconds',
            )
            .select('trip_id')
            .orderBy('trip_id')
            .execute(),
          [{ trip_id: 'a' }, { trip_id: 'b' }],
        );
      },
    });
    const trips = gtfs.schedule.trips;
    const times = gtfs.schedule.stopTimes;
    assert.equal(await trips.count(), 3);
    assert.equal(await allSources.schedule.trips.count(), 6);
    assert.equal(await trips.where({ source_id: 'south' }).count(), 0);
    assert.equal(await trips.select('source_id').count(), 3);
    assert.equal(await trips.where({ trip_id: 'missing' }).count(), 0);
    assert.equal(await trips.offset(1).count(), 2);
    assert.equal(await trips.offset(9).count(), 0);
    assert.equal(await trips.limit(0).count(), 0);
    const paged = trips
      .orderBy([{ field: 'trip_id' }])
      .offset(1)
      .limit(1);
    assert.equal(await paged.count(), 1);
    assert.deepEqual(await paged.select('trip_id').all(), [{ trip_id: 'b' }]);
    await gtfs.database.withKysely({
      callback: async (db) => {
        assert.deepEqual(
          await db
            .selectFrom('trips')
            .where('source_id', '=', 'north')
            .where((eb) =>
              eb.exists(
                eb
                  .selectFrom('routes')
                  .select('route_id')
                  .whereRef('routes.source_id', '=', 'trips.source_id')
                  .whereRef('routes.route_id', '=', 'trips.route_id')
                  .where(
                    sql<boolean>`${sql.ref('routes._node_gtfs_casefold_route_long_name')} like ${'str%'} escape '!'`,
                  ),
              ),
            )
            .select('trip_id')
            .orderBy('trip_id')
            .execute(),
          [{ trip_id: 'a' }, { trip_id: 'b' }, { trip_id: 'c' }],
        );
        assert.deepEqual(
          await db
            .selectFrom('routes')
            .where('source_id', '=', 'north')
            .where((eb) =>
              gtfs.database.dialect === 'sqlite'
                ? sql<boolean>`${eb.ref('route_long_name')} glob ${'str*'}`
                : sql<boolean>`${eb.ref('route_long_name')} like ${'str%'} escape '!'`,
            )
            .select('route_id')
            .execute(),
          [],
        );
        assert.equal(
          (
            await db
              .selectFrom('stop_times')
              .where('source_id', '=', 'north')
              .where('arrival_service_day_seconds', 'is not', null)
              .orderBy('arrival_service_day_seconds')
              .select('trip_id')
              .executeTakeFirst()
          )?.trip_id,
          'a',
        );
      },
    });
    const buffered = trips
      .select('trip_id')
      .orderBy([{ field: 'trip_id', direction: 'asc' }])
      .all();
    assert.equal(buffered instanceof Promise, true);
    assert.strictEqual(await buffered, await buffered);
    const iterated = [];
    for await (const row of trips
      .select('trip_id')
      .orderBy([{ field: 'trip_id', direction: 'asc' }])
      .stream()) {
      iterated.push(row);
    }
    assert.deepEqual(iterated, await buffered);
    const shapes = gtfs.schedule.shapes
      .orderBy([{ field: 'shape_pt_sequence', direction: 'asc' }])
      .select('shape_pt_sequence');
    let streamedCount = 0;
    let sequenceSum = 0;
    for await (const row of shapes.stream()) {
      streamedCount += 1;
      sequenceSum += row.shape_pt_sequence;
    }
    assert.equal(streamedCount, 2105);
    assert.equal(sequenceSum, (2105 * 2106) / 2);
    let partialCount = 0;
    for await (const row of shapes.stream()) {
      partialCount += 1;
      assert.equal(row.shape_pt_sequence, partialCount);
      if (partialCount === 1003) {
        break;
      }
    }
    assert.equal(partialCount, 1003);
    const consumerError = new Error('Stop streaming');
    await assert.rejects(
      async () => {
        for await (const row of shapes.stream()) {
          assert.equal(row.shape_pt_sequence, 1);
          throw consumerError;
        }
      },
      (error) => error === consumerError,
    );
    assert.deepEqual(await shapes.first(), { shape_pt_sequence: 1 });
    assert.deepEqual(await shapes.offset(1000).firstOrThrow(), {
      shape_pt_sequence: 1001,
    });
    await assert.rejects(() => shapes.limit(0).firstOrThrow(), {
      code: 'GTFS_QUERY_INVALID',
      details: { reason: 'NO_ROWS' },
    });
    const closing = new Gtfs({ database, reporting: { level: 'silent' } });
    try {
      const iterator = closing.schedule.shapes.stream()[Symbol.asyncIterator]();
      assert.equal((await iterator.next()).done, false);
      await closing.close();
      assert.equal((await iterator.next()).done, true);
      assert.deepEqual(await shapes.first(), { shape_pt_sequence: 1 });
    } finally {
      await closing.close();
    }
    await gtfs.database.withKysely({
      callback: async (db) => {
        const matching = await db
          .selectFrom('trips')
          .where('source_id', '=', 'north')
          .where((eb) =>
            eb.or([
              eb('source_id', '=', 'south'),
              eb.and([
                eb.exists(
                  eb
                    .selectFrom(activeTripKeys(db, 20260912).as('active'))
                    .select('active.trip_id')
                    .whereRef('active.source_id', '=', 'trips.source_id')
                    .whereRef('active.trip_id', '=', 'trips.trip_id'),
                ),
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
              ]),
            ]),
          )
          .select((eb) =>
            integerText(eb.fn.countAll(), gtfs.database.dialect).as('total'),
          )
          .executeTakeFirstOrThrow();
        assert.equal(safeInteger(matching.total), 1);
        const times = db
          .selectFrom('stop_times')
          .where('source_id', '=', 'north');
        assert.deepEqual(
          await times
            .whereRef(
              'departure_service_day_seconds',
              '<',
              'arrival_service_day_seconds',
            )
            .select('trip_id')
            .execute(),
          [{ trip_id: 'b' }],
        );
        const different = await times
          .whereRef(
            'departure_service_day_seconds',
            '!=',
            'arrival_service_day_seconds',
          )
          .select((eb) =>
            integerText(eb.fn.countAll(), gtfs.database.dialect).as('total'),
          )
          .executeTakeFirstOrThrow();
        assert.equal(safeInteger(different.total), 2);
        const routes = db
          .selectFrom('routes')
          .where('source_id', '=', 'north')
          .select('route_id');
        assert.deepEqual(
          await routes
            .where(
              sql<boolean>`${sql.ref('routes._node_gtfs_casefold_route_short_name')} = ${sql.ref('routes._node_gtfs_casefold_route_long_name')}`,
            )
            .execute(),
          [{ route_id: 'red' }],
        );
        assert.deepEqual(
          await routes
            .whereRef('route_short_name', '=', 'route_long_name')
            .execute(),
          [],
        );
      },
    });
    await gtfs.database.withKysely({
      callback: (db) =>
        sql`alter table stop_times rename column departure_service_day_seconds to missing_seconds`.execute(
          db,
        ),
    });
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
              .select((eb) =>
                integerText(eb.fn.countAll(), gtfs.database.dialect).as(
                  'total',
                ),
              )
              .executeTakeFirstOrThrow(),
        }),
      (error) => error instanceof Error && !isGtfsError(error),
    );
    await assert.rejects(
      () => times.select('departure_service_day_seconds').all(),
      { code: 'GTFS_SCHEMA_INVALID' },
    );
    // Advanced SQL does not infer the reader's schema preflight.
    await assert.rejects(
      () =>
        gtfs.database.withKysely({
          callback: (db) =>
            db
              .selectFrom('stop_times')
              .select((eb) =>
                eb.fn.max('departure_service_day_seconds').as('latest'),
              )
              .executeTakeFirstOrThrow(),
        }),
      (error) => error instanceof Error && !isGtfsError(error),
    );
    assert.equal(await gtfs.schedule.areas.count(), 0);
    await assert.rejects(() => gtfs.gtfsPlus.directions.count(), {
      code: 'GTFS_EXTENSION_DISABLED',
    });
    await gtfs.database.withKysely({
      callback: (db) => db.schema.dropTable('areas').execute(),
    });
    await assert.rejects(() => gtfs.schedule.areas.count(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
  } finally {
    await Promise.all([gtfs.close(), allSources.close()]);
    await rm(directory, { recursive: true, force: true });
  }
}
