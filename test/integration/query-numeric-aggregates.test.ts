import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Gtfs } from '../../src/index.ts';
import {
  integerText,
  nullableNumber,
  safeInteger,
} from '../helpers/advanced-summary-recipes.ts';

test('SQL sums and averages preserve source scope, nulls, numeric values and input stages', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(`INSERT INTO stop_times (source_id, trip_id, stop_sequence, arrival_time, shape_dist_traveled) VALUES
      ('north','a',1,'09:00:00',1.25), ('north','a',2,'10:00:00',2.5), ('north','b',3,NULL,NULL), ('south','a',100,'12:00:00',100)`);
    await gtfs.database.withKysely({
      callback: async (db) => {
        const times = db
          .selectFrom('stop_times')
          .where('source_id', '=', 'north');
        const totals = await times
          .select((eb) => [
            integerText(eb.fn.countAll(), 'sqlite').as('count'),
            integerText(eb.fn.sum('stop_sequence'), 'sqlite').as('sum'),
            eb.fn.avg<number | null>('stop_sequence').as('avg'),
            eb.fn.sum<number | null>('shape_dist_traveled').as('distance'),
            eb.fn
              .avg<number | null>('shape_dist_traveled')
              .as('averageDistance'),
            integerText(eb.fn.sum('arrival_service_day_seconds'), 'sqlite').as(
              'seconds',
            ),
            eb.fn
              .avg<number | null>('arrival_service_day_seconds')
              .as('averageSeconds'),
          ])
          .executeTakeFirstOrThrow();
        assert.deepEqual(
          {
            ...totals,
            count: safeInteger(totals.count),
            sum: safeInteger(totals.sum),
            seconds: safeInteger(totals.seconds),
          },
          {
            count: 3,
            sum: 6,
            avg: 2,
            distance: 3.75,
            averageDistance: 1.875,
            seconds: 68400,
            averageSeconds: 34200,
          },
        );
        const page = times.selectAll().orderBy('stop_sequence').limit(2);
        const summary = await db
          .selectFrom(page.as('page'))
          .select((eb) => [
            integerText(eb.fn.sum('stop_sequence'), 'sqlite').as('sum'),
            eb.fn.avg<number | null>('stop_sequence').as('avg'),
          ])
          .executeTakeFirstOrThrow();
        assert.deepEqual(
          { sum: safeInteger(summary.sum), avg: nullableNumber(summary.avg) },
          { sum: 3, avg: 1.5 },
        );
        const ranked = times
          .select(['source_id', 'stop_sequence'])
          .select((eb) =>
            eb.fn
              .agg<number>('row_number', [])
              .over((window) =>
                window
                  .partitionBy(['source_id', 'trip_id'])
                  .orderBy('stop_sequence', 'desc'),
              )
              .as('position'),
          );
        const representatives = await db
          .selectFrom(ranked.as('ranked'))
          .where('position', '=', 1)
          .select('source_id')
          .select((eb) => [
            integerText(eb.fn.sum('stop_sequence'), 'sqlite').as('sum'),
            eb.fn.avg<number | null>('stop_sequence').as('avg'),
          ])
          .groupBy('source_id')
          .execute();
        assert.deepEqual(
          representatives.map((row) => ({ ...row, sum: safeInteger(row.sum) })),
          [{ source_id: 'north', sum: 5, avg: 2.5 }],
        );
        for (const input of [
          times.where('trip_id', '=', 'missing').selectAll(),
          times.selectAll().limit(0),
        ]) {
          assert.deepEqual(
            await db
              .selectFrom(input.as('input'))
              .select((eb) => [
                eb.fn.sum('stop_sequence').as('sum'),
                eb.fn.avg('stop_sequence').as('avg'),
              ])
              .executeTakeFirstOrThrow(),
            { sum: null, avg: null },
          );
        }
        assert.deepEqual(
          await times
            .select('trip_id')
            .select((eb) => [
              eb.fn.sum<number | null>('shape_dist_traveled').as('sum'),
              eb.fn.avg<number | null>('shape_dist_traveled').as('avg'),
            ])
            .groupBy('trip_id')
            .orderBy('trip_id')
            .execute(),
          [
            { trip_id: 'a', sum: 3.75, avg: 1.875 },
            { trip_id: 'b', sum: null, avg: null },
          ],
        );
      },
    });
    database.exec(
      "INSERT INTO stops (source_id, stop_id, stop_lat) VALUES ('north','a',-2.5),('north','b',1.25)",
    );
    assert.deepEqual(
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .selectFrom('stops')
            .where('source_id', '=', 'north')
            .select((eb) => [
              eb.fn.sum<number | null>('stop_lat').as('sum'),
              eb.fn.avg<number | null>('stop_lat').as('avg'),
            ])
            .executeTakeFirstOrThrow(),
      }),
      { sum: -1.25, avg: -0.625 },
    );
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('SQL sums preserve exact integers and expose backend overflow for explicit conversion policy', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(`INSERT INTO shapes (source_id, shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon, shape_dist_traveled)
      VALUES ('north','a',9007199254740991,0,0,1e308), ('north','b',9007199254740991,0,0,1e308)`);
    await gtfs.database.withKysely({
      callback: async (db) => {
        const totals = await db
          .selectFrom('shapes')
          .select((eb) => [
            integerText(eb.fn.sum('shape_pt_sequence'), 'sqlite').as(
              'sequence',
            ),
            eb.fn.sum<number | null>('shape_dist_traveled').as('distance'),
            eb.fn.avg<number | null>('shape_dist_traveled').as('average'),
          ])
          .executeTakeFirstOrThrow();
        assert.equal(totals.sequence, '18014398509481982');
        assert.throws(() => safeInteger(totals.sequence), RangeError);
        assert.throws(() => nullableNumber(totals.distance), RangeError);
        assert.throws(() => nullableNumber(totals.average), RangeError);
      },
    });
    database.exec(`WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM ids WHERE id < 1100)
      INSERT INTO shapes (source_id, shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon)
      SELECT 'north', CAST(id AS TEXT), 9007199254740991, 0, 0 FROM ids`);
    await assert.rejects(
      () =>
        gtfs.database.withKysely({
          callback: (db) =>
            db
              .selectFrom('shapes')
              .select((eb) =>
                integerText(eb.fn.sum('shape_pt_sequence'), 'sqlite').as(
                  'total',
                ),
              )
              .executeTakeFirstOrThrow(),
        }),
      { code: 'SQLITE_ERROR', message: 'integer overflow' },
    );
    assert.equal(await gtfs.schedule.shapes.count(), 1102);
    database.exec('UPDATE shapes SET shape_pt_sequence = 9007199254740992');
    const average = await gtfs.database.withKysely({
      callback: (db) =>
        db
          .selectFrom('shapes')
          .select((eb) => eb.fn.avg<number>('shape_pt_sequence').as('value'))
          .executeTakeFirstOrThrow(),
    });
    assert.ok(Math.abs(average.value) > Number.MAX_SAFE_INTEGER);
  } finally {
    await gtfs.close();
    database.close();
  }
});
