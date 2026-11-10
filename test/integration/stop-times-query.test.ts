import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sql } from 'kysely';
import { Gtfs } from '../../src/index.ts';
describe('stop-time SQL queries', () => {
  test('applies both time bounds to arrivals and preserves post-midnight service times', async () => {
    const gtfs = new Gtfs({
      database: {},
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: (database) =>
          sql`insert into stop_times
            (source_id, trip_id, arrival_time, departure_time, stop_id, stop_sequence)
            values
              ('test', 'before', '15:00:00', '15:01:00', 'platform', 1),
              ('test', 'edge', '15:58:00', '16:02:00', 'platform', 1),
              ('test', 'after', '16:01:00', '16:02:00', 'platform', 1),
              ('test', 'overnight', '25:30:00', '25:35:00', 'platform', 1)`.execute(
            database,
          ),
      });
      assert.deepEqual(
        await gtfs.database.withKysely({
          callback: (db) =>
            db
              .selectFrom('stop_times')
              .where('source_id', '=', 'test')
              .where('stop_id', '=', 'platform')
              .where('arrival_service_day_seconds', '>=', 57480)
              .where('arrival_service_day_seconds', '<=', 57600)
              .select([
                'trip_id',
                'arrival_time',
                'departure_time',
                'arrival_service_day_seconds',
              ])
              .execute(),
        }),
        [
          {
            trip_id: 'edge',
            arrival_time: '15:58:00',
            departure_time: '16:02:00',
            arrival_service_day_seconds: 57480,
          },
        ],
      );
      assert.deepEqual(
        await gtfs.database.withKysely({
          callback: (db) =>
            db
              .selectFrom('stop_times')
              .where('source_id', '=', 'test')
              .where('stop_id', '=', 'platform')
              .where('arrival_service_day_seconds', '>=', 90000)
              .where('arrival_service_day_seconds', '<=', 93600)
              .select(['trip_id', 'arrival_service_day_seconds'])
              .execute(),
        }),
        [{ trip_id: 'overnight', arrival_service_day_seconds: 91800 }],
      );
    } finally {
      await gtfs.close();
    }
  });
  test('uses the stop-and-arrival index for a two-sided arrival range', async () => {
    const gtfs = new Gtfs({
      database: {},
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      const details = await gtfs.database.withKysely({
        callback: async (database) => {
          const plan = await sql<{
            detail: string;
          }>`explain query plan
            select trip_id from stop_times
            where stop_id = ${'platform'}
              and arrival_service_day_seconds >= ${57480}
              and arrival_service_day_seconds <= ${57600}`.execute(database);
          return plan.rows.map((row) => row.detail);
        },
      });
      assert.equal(
        details.some((detail) =>
          detail.includes('idx_stop_times_stop_id_arrival_service_day_seconds'),
        ),
        true,
      );
    } finally {
      await gtfs.close();
    }
  });
});
