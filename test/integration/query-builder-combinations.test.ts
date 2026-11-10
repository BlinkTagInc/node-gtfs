import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Gtfs } from '../../src/index.ts';
import {
  integerText,
  rankedTrips,
  representativeTrips,
  safeInteger,
} from '../helpers/advanced-summary-recipes.ts';

async function createFixture() {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(`
      INSERT INTO trips (source_id, trip_id, route_id, service_id) VALUES
        ('north','1','blue','s'), ('north','2','blue','s'),
        ('north','3','red','s'), ('north','4','red','s'),
        ('south','1','blue','s'), ('south','2','green','s'), ('south','3','red','s');
      INSERT INTO stop_times (source_id, trip_id, stop_sequence, arrival_time) VALUES
        ('north','1',1,'9:00:00'), ('north','2',1,'09:00:00'),
        ('north','3',1,'100:00:00'), ('north','4',1,NULL), ('south','1',1,'9:00:00');
    `);
    return { database, gtfs };
  } catch (error) {
    await gtfs.close();
    database.close();
    throw error;
  }
}

test('SQL representatives preserve source keys, filtered input, projection, counts and pagination', async () => {
  const { database, gtfs } = await createFixture();
  try {
    database.exec(
      "UPDATE trips SET block_id = 'b' WHERE source_id = 'north' AND trip_id = '4'",
    );
    await gtfs.database.withKysely({
      callback: async (db) => {
        const rows = representativeTrips(db, ['north', 'south'])
          .orderBy('route_id')
          .orderBy('source_id');
        assert.deepEqual(
          await rows.select(['source_id', 'trip_id']).execute(),
          [
            { source_id: 'north', trip_id: '2' },
            { source_id: 'south', trip_id: '1' },
            { source_id: 'south', trip_id: '2' },
            { source_id: 'north', trip_id: '4' },
            { source_id: 'south', trip_id: '3' },
          ],
        );
        for (const [input, expected] of [
          [rows, 5],
          [rows.offset(1).limit(3), 3],
          [rows.limit(0), 0],
          [rows.offset(5).limit(1), 0],
        ] as const) {
          const total = await db
            .selectFrom(input.select('trip_id').as('page'))
            .select((eb) => integerText(eb.fn.countAll(), 'sqlite').as('total'))
            .executeTakeFirstOrThrow();
          assert.equal(safeInteger(total.total), expected);
        }
        assert.deepEqual(
          await rows.offset(1).limit(1).select('trip_id').execute(),
          [{ trip_id: '1' }],
        );
        assert.equal(
          (await db.selectFrom('trips').select('block_id').distinct().execute())
            .length,
          2,
        );
        assert.equal(
          (
            await db
              .selectFrom('trips')
              .select(['source_id', 'route_id'])
              .distinct()
              .execute()
          ).length,
          5,
        );
        const filtered = rankedTrips(db, ['north'])
          .where('trip_id', '!=', '4')
          .where('route_id', '=', 'red');
        assert.deepEqual(
          await db
            .selectFrom(filtered.as('ranked'))
            .where('position', '=', 1)
            .select('trip_id')
            .execute(),
          [{ trip_id: '3' }],
        );
        // The partition can deliberately span sources; its key need not be selected.
        const acrossSources = db
          .selectFrom('trips')
          .select(['route_id', 'trip_id'])
          .select((eb) =>
            eb.fn
              .agg<number>('row_number', [])
              .over((w) =>
                w
                  .partitionBy('route_id')
                  .orderBy('trip_id', 'desc')
                  .orderBy('source_id'),
              )
              .as('position'),
          );
        assert.deepEqual(
          await db
            .selectFrom(acrossSources.as('ranked'))
            .where('position', '=', 1)
            .select('trip_id')
            .orderBy('route_id')
            .execute(),
          [{ trip_id: '2' }, { trip_id: '2' }, { trip_id: '4' }],
        );
      },
    });
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('replacing reader selection and pagination settings does not mutate sibling queries', async () => {
  const { database, gtfs } = await createFixture();
  try {
    const base = gtfs.schedule.trips
      .where({ source_id: 'north' })
      .orderBy([
        { field: 'route_id', direction: 'asc' },
        { field: 'trip_id', direction: 'desc' },
      ])
      .select('trip_id');
    const pending = base.all();
    const branch = base
      .orderBy([{ field: 'trip_id', direction: 'asc' }])
      .select('source_id')
      .limit(0)
      .limit(1)
      .offset(4)
      .offset(0);
    assert.deepEqual(await branch.all(), [{ source_id: 'north' }]);
    assert.deepEqual(await pending, [
      { trip_id: '2' },
      { trip_id: '1' },
      { trip_id: '4' },
      { trip_id: '3' },
    ]);
    assert.deepEqual(await base.all(), await pending);
    assert.deepEqual(
      await base.where({ trip_id: '3' }).where({ route_id: 'red' }).first(),
      { trip_id: '3' },
    );
    assert.deepEqual(await base.first({ trip_id: '3' }), { trip_id: '3' });
    assert.equal(await base.first({ source_id: 'south' }), null);
    assert.deepEqual(await base.limit(8).offset(1).first(), { trip_id: '1' });
    assert.equal(await base.offset(4).first(), null);
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('SQL time partitions combine equivalent spellings before ordering and counting', async () => {
  const { database, gtfs } = await createFixture();
  try {
    await gtfs.database.withKysely({
      callback: async (db) => {
        const input = db
          .selectFrom('stop_times')
          .where('source_id', '=', 'north');
        const ranked = input
          .where('arrival_service_day_seconds', 'is not', null)
          .select(['trip_id', 'arrival_time', 'arrival_service_day_seconds'])
          .select((eb) =>
            eb.fn
              .agg<number>('row_number', [])
              .over((w) =>
                w
                  .partitionBy('arrival_service_day_seconds')
                  .orderBy('trip_id', 'desc'),
              )
              .as('position'),
          );
        const times = db
          .selectFrom(ranked.as('ranked'))
          .where('position', '=', 1)
          .orderBy('arrival_service_day_seconds');
        assert.deepEqual(
          await times.select(['trip_id', 'arrival_time']).execute(),
          [
            { trip_id: '2', arrival_time: '09:00:00' },
            { trip_id: '3', arrival_time: '100:00:00' },
          ],
        );
        for (const [page, expected] of [
          [times, 2],
          [times.offset(1).limit(1), 1],
        ] as const) {
          const row = await db
            .selectFrom(page.select('trip_id').as('page'))
            .select((eb) => integerText(eb.fn.countAll(), 'sqlite').as('total'))
            .executeTakeFirstOrThrow();
          assert.equal(safeInteger(row.total), expected);
        }
        const keys = input.select('arrival_service_day_seconds').distinct();
        const row = await db
          .selectFrom(keys.as('keys'))
          .select((eb) => integerText(eb.fn.countAll(), 'sqlite').as('total'))
          .executeTakeFirstOrThrow();
        assert.equal(safeInteger(row.total), 3);
      },
    });
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('array promises retain results while repeated terminal calls read current data', async () => {
  const { database, gtfs } = await createFixture();
  try {
    const query = gtfs.schedule.trips
      .where({ source_id: 'north' })
      .orderBy([{ field: 'trip_id', direction: 'asc' }])
      .select('trip_id');
    const pending = query.limit(1).all();
    assert.deepEqual(await pending, [{ trip_id: '1' }]);
    database.exec(
      "DELETE FROM trips WHERE source_id = 'north' AND trip_id = '1'",
    );
    database.exec(
      "DELETE FROM trips WHERE source_id = 'north' AND trip_id = '2'",
    );
    assert.deepEqual(await pending, [{ trip_id: '1' }]);
    assert.deepEqual(await query.limit(1).all(), [{ trip_id: '3' }]);
    const iterated = [];
    for await (const row of query.limit(2).stream()) {
      iterated.push(row);
    }
    assert.deepEqual(iterated, [{ trip_id: '3' }, { trip_id: '4' }]);
    assert.deepEqual(await query.limit(1).first(), { trip_id: '3' });
  } finally {
    await gtfs.close();
    database.close();
  }
});
