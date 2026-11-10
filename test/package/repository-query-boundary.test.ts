import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sql } from 'kysely';
import { Gtfs, GtfsErrorCode } from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';
describe('repository query boundary', () => {
  test('advanced access reads unscoped stored values while repositories retain scope and public money values', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.ensure();
      await gtfs.database.withKysely({
        callback: (database) =>
          sql`insert into fare_attributes
            (source_id, fare_id, price, currency_type, payment_method, transfers)
            values ('north', 'shared', 123, 'USD', 0, 0),
                   ('south', 'shared', 456, 'USD', 0, 0)`.execute(database),
      });

      assert.deepEqual(
        await gtfs.schedule.fareAttributes
          .select('source_id', 'fare_id', 'price')
          .all(),
        [{ source_id: 'north', fare_id: 'shared', price: '1.23' }],
      );
      assert.deepEqual(
        await gtfs.schedule.fareAttributes.where({ source_id: 'south' }).all(),
        [],
      );
      assert.deepEqual(
        await gtfs.database.withKysely({
          callback: (database) =>
            database
              .selectFrom('fare_attributes')
              .select(['source_id', 'fare_id', 'price'])
              .orderBy('source_id')
              .execute(),
        }),
        [
          { source_id: 'north', fare_id: 'shared', price: 123 },
          { source_id: 'south', fare_id: 'shared', price: 456 },
        ],
      );
    } finally {
      await gtfs.close();
    }
  });

  test('validates identifiers and binds untrusted values', async () => {
    const gtfs = new Gtfs({
      database: {},
      extensions: ['gtfs-realtime'],
    });
    const untrustedValue = "red' OR 1 = 1 --";
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: (database) =>
          sql`insert into routes
            (source_id, route_id, route_short_name, route_type)
            values
              ('test', ${untrustedValue}, 'Untrusted', 3),
              ('test', 'blue', 'Blue', 3)`.execute(database),
      });
      assert.deepEqual(
        await gtfs.schedule.routes
          .where({ route_id: untrustedValue })
          .select('route_id')
          .all(),
        [{ route_id: untrustedValue }],
      );
      await assert.rejects(
        async () =>
          gtfs.schedule.routes
            .select('route_id; drop table routes' as never)
            .all(),
        (error: unknown) =>
          (
            error as {
              code?: unknown;
            }
          ).code === GtfsErrorCode.QUERY_INVALID,
      );
      assert.equal(await gtfs.schedule.routes.count(), 2);
    } finally {
      await gtfs.close();
    }
  });
  test('keeps physical columns out of defaults and supports selecting derived seconds', async () => {
    const gtfs = new Gtfs({
      database: {},
      extensions: ['gtfs-realtime'],
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: async (database) => {
          await sql`alter table stop_times add column _future_internal text`.execute(
            database,
          );
          await sql`insert into stop_times
            (source_id, trip_id, arrival_time, departure_time, stop_id, stop_sequence, _future_internal)
            values
            ('test', 'trip-1', '25:01:02', '25:02:03', 'stop-1', 1, 'private')`.execute(
            database,
          );
        },
      });
      const row = await gtfs.schedule.stopTimes.first();
      assert.ok(row);
      assert.deepEqual(
        Object.keys(row),
        gtfsManifest.stop_times!.defaultSelectedFields,
      );
      assert.equal('_future_internal' in row, false);
      assert.equal('arrival_service_day_seconds' in row, false);
      assert.deepEqual(
        await gtfs.schedule.stopTimes
          .select('trip_id', 'arrival_time', 'arrival_service_day_seconds')
          .first(),
        {
          trip_id: 'trip-1',
          arrival_time: '25:01:02',
          arrival_service_day_seconds: 90062,
        },
      );
    } finally {
      await gtfs.close();
    }
  });
});
