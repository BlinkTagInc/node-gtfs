import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Gtfs } from '../../../src/index.ts';
import {
  integerText,
  nullableNumber,
  rankedTrips,
  representativeTrips,
  safeInteger,
  serviceTime,
} from '../../helpers/advanced-summary-recipes.ts';

// Uses the north/south feed imported by verifyAggregateAndFieldReferenceIntegration.
export async function verifyAdvancedSummaries(gtfs: Gtfs): Promise<void> {
  const dialect = gtfs.database.dialect;
  await gtfs.database.withKysely({
    callback: async (database) => {
      const trips = database
        .selectFrom('trips')
        .where('source_id', '=', 'north');
      const summary = await trips
        .select((eb) => [
          integerText(eb.fn.countAll(), dialect).as('total'),
          integerText(eb.fn.count('direction_id'), dialect).as('directions'),
          integerText(eb.fn.min('direction_id'), dialect).as('first'),
          integerText(eb.fn.max('direction_id'), dialect).as('last'),
          integerText(eb.fn.sum('direction_id'), dialect).as('sum'),
          eb.fn.avg<string | number | null>('direction_id').as('average'),
        ])
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        {
          total: safeInteger(summary.total),
          directions: safeInteger(summary.directions),
          first: safeInteger(summary.first),
          last: safeInteger(summary.last),
          sum: safeInteger(summary.sum),
          average: nullableNumber(summary.average),
        },
        { total: 3, directions: 2, first: 0, last: 1, sum: 1, average: 0.5 },
      );

      // The outer summary sees the paginated input, not the entire trips table.
      const page = trips
        .select(['trip_id', 'direction_id'])
        .orderBy('trip_id')
        .offset(1)
        .limit(2);
      const pageSummary = await database
        .selectFrom(page.as('page'))
        .select((eb) => [
          integerText(eb.fn.countAll(), dialect).as('total'),
          integerText(eb.fn.count('direction_id'), dialect).as('directions'),
          eb.fn.max('trip_id').as('latest'),
        ])
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        {
          ...pageSummary,
          total: safeInteger(pageSummary.total),
          directions: safeInteger(pageSummary.directions),
        },
        { total: 2, directions: 1, latest: 'c' },
      );

      for (const input of [
        trips.where('trip_id', '=', 'missing').selectAll(),
        trips.selectAll().limit(0),
      ]) {
        const empty = await database
          .selectFrom(input.as('input'))
          .select((eb) => [
            integerText(eb.fn.countAll(), dialect).as('total'),
            eb.fn.min('trip_id').as('first'),
            eb.fn.sum('direction_id').as('sum'),
            eb.fn.avg('direction_id').as('average'),
          ])
          .executeTakeFirstOrThrow();
        assert.deepEqual(
          { ...empty, total: safeInteger(empty.total) },
          { total: 0, first: null, sum: null, average: null },
        );
      }
      const nulls = await trips
        .where('trip_id', '=', 'c')
        .select((eb) => [
          integerText(eb.fn.count('direction_id'), dialect).as('total'),
          eb.fn.sum('direction_id').as('sum'),
          eb.fn.avg('direction_id').as('average'),
        ])
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        { ...nulls, total: safeInteger(nulls.total) },
        { total: 0, sum: null, average: null },
      );

      // Group source identity explicitly even though the instance is north-scoped.
      const groups = database
        .selectFrom('trips')
        .select(['source_id', 'route_id'])
        .select((eb) => integerText(eb.fn.countAll(), dialect).as('total'))
        .groupBy(['source_id', 'route_id'])
        .orderBy('source_id');
      assert.deepEqual(
        (await groups.execute()).map((row) => ({
          ...row,
          total: safeInteger(row.total),
        })),
        [
          { source_id: 'north', route_id: 'red', total: 3 },
          { source_id: 'south', route_id: 'red', total: 3 },
        ],
      );
      assert.deepEqual(
        (await groups.offset(1).limit(1).execute()).map((row) => ({
          ...row,
          total: safeInteger(row.total),
        })),
        [{ source_id: 'south', route_id: 'red', total: 3 }],
      );
      assert.deepEqual(await groups.limit(0).execute(), []);
      assert.deepEqual(
        await database
          .selectFrom('areas')
          .select('area_id')
          .groupBy('area_id')
          .execute(),
        [],
      );

      const representatives = representativeTrips(database, ['north', 'south']);
      const streamed = [];
      for await (const row of representatives
        .select(['source_id', 'trip_id'])
        .orderBy('source_id')
        .stream(1)) {
        streamed.push(row);
      }
      assert.deepEqual(streamed, [
        { source_id: 'north', trip_id: 'c' },
        { source_id: 'south', trip_id: 'c' },
      ]);
      for await (const row of representatives
        .select('source_id')
        .orderBy('source_id')
        .stream(1)) {
        assert.equal(row.source_id, 'north');
        break;
      }
      // The following queries must work after early cursor termination, including max:1 pools.
      const qualified = rankedTrips(database, ['north', 'south']).where((eb) =>
        eb.exists(
          eb
            .selectFrom('stop_times')
            .select('stop_sequence')
            .whereRef('stop_times.source_id', '=', 'trips.source_id')
            .whereRef('stop_times.trip_id', '=', 'trips.trip_id')
            .where('arrival_service_day_seconds', '>', 86400),
        ),
      );
      assert.deepEqual(
        await database
          .selectFrom(qualified.as('ranked'))
          .where('position', '=', 1)
          .select(['source_id', 'trip_id'])
          .orderBy('source_id')
          .execute(),
        [
          { source_id: 'north', trip_id: 'b' },
          { source_id: 'south', trip_id: 'b' },
        ],
      );
      assert.deepEqual(
        await representatives
          .select(['source_id', 'trip_id'])
          .orderBy('source_id')
          .execute(),
        [
          { source_id: 'north', trip_id: 'c' },
          { source_id: 'south', trip_id: 'c' },
        ],
      );
      assert.deepEqual(
        await representativeTrips(database, ['north'])
          .select(['source_id', 'trip_id'])
          .execute(),
        [{ source_id: 'north', trip_id: 'c' }],
      );
      assert.deepEqual(
        await representativeTrips(database, []).select('trip_id').execute(),
        [],
      );
      const representativePage = representatives
        .select(['source_id', 'trip_id', 'service_id'])
        .orderBy('source_id')
        .offset(1)
        .limit(1);
      const representativeCount = await database
        .selectFrom(representativePage.as('page'))
        .select((eb) => integerText(eb.fn.countAll(), dialect).as('total'))
        .executeTakeFirstOrThrow();
      assert.equal(safeInteger(representativeCount.total), 1);
      const emptyRepresentativeCount = await database
        .selectFrom(representativePage.limit(0).as('page'))
        .select((eb) => integerText(eb.fn.countAll(), dialect).as('total'))
        .executeTakeFirstOrThrow();
      assert.equal(safeInteger(emptyRepresentativeCount.total), 0);
      const representativeGroups = await database
        .selectFrom(representativePage.as('page'))
        .select('service_id')
        .select((eb) => [
          integerText(eb.fn.countAll(), dialect).as('total'),
          eb.fn.min('source_id').as('source'),
        ])
        .groupBy('service_id')
        .execute();
      assert.deepEqual(
        representativeGroups.map((row) => ({
          ...row,
          total: safeInteger(row.total),
        })),
        [{ service_id: 'weekend', total: 1, source: 'south' }],
      );
      // Group paging is independent of paging the input representatives.
      const representativeGroupPage = await database
        .selectFrom(
          representatives.select(['source_id', 'trip_id']).as('input'),
        )
        .select('source_id')
        .select((eb) => [
          integerText(eb.fn.countAll(), dialect).as('total'),
          eb.fn.max('trip_id').as('latest'),
        ])
        .groupBy('source_id')
        .orderBy('source_id', 'desc')
        .offset(1)
        .limit(1)
        .execute();
      assert.deepEqual(
        representativeGroupPage.map((row) => ({
          ...row,
          total: safeInteger(row.total),
        })),
        [{ source_id: 'north', total: 1, latest: 'c' }],
      );
      const uniqueDirections = await trips
        .select('direction_id')
        .distinct()
        .execute();
      assert.deepEqual(uniqueDirections.map((row) => row.direction_id).sort(), [
        0,
        1,
        null,
      ]);
      assert.deepEqual(
        await database
          .selectFrom('trips')
          .select('route_id')
          .distinct()
          .execute(),
        [{ route_id: 'red' }],
      );

      // GTFS times are ordered/aggregated numerically, then formatted, never MIN(text).
      const times = database
        .selectFrom('stop_times')
        .where('source_id', '=', 'north');
      const timeSummary = await times
        .select((eb) => [
          integerText(eb.fn.min('arrival_service_day_seconds'), dialect).as(
            'earliest',
          ),
          integerText(eb.fn.max('arrival_service_day_seconds'), dialect).as(
            'latest',
          ),
          integerText(eb.fn.sum('arrival_service_day_seconds'), dialect).as(
            'sum',
          ),
          eb.fn
            .avg<string | number | null>('arrival_service_day_seconds')
            .as('average'),
        ])
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        {
          earliest: serviceTime(timeSummary.earliest),
          latest: serviceTime(timeSummary.latest),
          sum: safeInteger(timeSummary.sum),
          average: nullableNumber(timeSummary.average),
        },
        {
          earliest: '09:00:00',
          latest: '100:00:00',
          sum: 392400,
          average: 196200,
        },
      );
      const timeGroups = await times
        .where('arrival_service_day_seconds', 'is not', null)
        .select('arrival_service_day_seconds')
        .groupBy('arrival_service_day_seconds')
        .orderBy('arrival_service_day_seconds')
        .offset(1)
        .limit(10)
        .execute();
      assert.deepEqual(
        timeGroups.map((row) => serviceTime(row.arrival_service_day_seconds)),
        ['100:00:00'],
      );

      const shapes = database
        .selectFrom('shapes')
        .where('source_id', '=', 'north');
      const shapeSummary = await shapes
        .select((eb) => [
          integerText(eb.fn.sum('shape_pt_sequence'), dialect).as('sum'),
          eb.fn.avg<string | number | null>('shape_pt_sequence').as('average'),
        ])
        .executeTakeFirstOrThrow();
      assert.equal(safeInteger(shapeSummary.sum), (2105 * 2106) / 2);
      assert.equal(nullableNumber(shapeSummary.average), 1053);
      const shapePage = shapes
        .select(['shape_id', 'shape_dist_traveled', 'shape_pt_sequence'])
        .orderBy('shape_pt_sequence')
        .limit(2);
      const shapeGroups = await database
        .selectFrom(shapePage.as('page'))
        .select('shape_id')
        .select((eb) => [
          eb.fn.sum<string | number | null>('shape_dist_traveled').as('sum'),
          eb.fn
            .avg<string | number | null>('shape_dist_traveled')
            .as('average'),
          eb.fn.avg<string | number | null>('shape_pt_sequence').as('sequence'),
        ])
        .groupBy('shape_id')
        .execute();
      assert.deepEqual(
        shapeGroups.map((row) => ({
          shape_id: row.shape_id,
          sum: nullableNumber(row.sum),
          average: nullableNumber(row.average),
          sequence: nullableNumber(row.sequence),
        })),
        [{ shape_id: 'line', sum: 0.25, average: 0.125, sequence: 1.5 }],
      );

      // Cast before the driver can round BIGINT. Verify the rejected database value.
      const exact = await database
        .selectNoFrom(
          integerText(
            sql`cast(9007199254740993 as ${sql.raw(dialect === 'mysql' ? 'signed' : 'bigint')})`,
            dialect,
          ).as('value'),
        )
        .executeTakeFirstOrThrow();
      assert.equal(exact.value, '9007199254740993');
      assert.throws(() => safeInteger(exact.value), RangeError);
    },
  });
}
