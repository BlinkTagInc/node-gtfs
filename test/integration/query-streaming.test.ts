import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Gtfs, GtfsError } from '../../src/index.ts';

async function fixture() {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  await gtfs.schema.ensure();
  database.exec(`WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM ids WHERE id < 10000)
    INSERT INTO trips (source_id, trip_id, route_id, service_id)
    SELECT 'north', CAST(id AS TEXT), 'red', 'weekday' FROM ids`);
  return { database, gtfs };
}

test('first and firstOrThrow fetch at most one row, respect paging and preserve errors', async (t) => {
  const { database, gtfs } = await fixture();
  const bufferedRowCounts: number[] = [];
  const prepare = database.prepare.bind(database);
  t.mock.method(database, 'prepare', (query: string) => {
    const statement = prepare(query);
    if (query.includes('from "trips"')) {
      const all = statement.all.bind(statement);
      t.mock.method(statement, 'all', (...parameters: unknown[]) => {
        const rows = all(...parameters);
        bufferedRowCounts.push(rows.length);
        return rows;
      });
    }
    return statement;
  });
  try {
    const query = gtfs.schedule.trips
      .where({ route_id: 'red' })
      .select('trip_id')
      .orderBy([{ field: 'trip_id', direction: 'asc' }])
      .offset(1);
    for (const bounded of [query, query.limit(1), query.limit(9999)]) {
      assert.deepEqual(await bounded.firstOrThrow(), { trip_id: '10' });
      assert.deepEqual(await bounded.first(), { trip_id: '10' });
    }
    assert.deepEqual(bufferedRowCounts, [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(await query.offset(0).firstOrThrow({ trip_id: '20' }), {
      trip_id: '20',
    });
    for (const empty of [
      query.where({ trip_id: 'missing' }),
      query.limit(0),
      query.offset(10000),
    ]) {
      assert.equal(await empty.first(), null);
      await assert.rejects(() => empty.firstOrThrow(), {
        code: 'GTFS_QUERY_INVALID',
        details: { reason: 'NO_ROWS' },
      });
    }
    await assert.rejects(() => query.firstOrThrow({ route_id: 'blue' }), {
      details: { reason: 'NO_ROWS' },
    });
    assert.ok(bufferedRowCounts.every((count) => count <= 1));
    database.exec('DROP TABLE trips');
    await assert.rejects(() => query.firstOrThrow(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('all starts one ordinary promise immediately; streams start on demand and do not replay', async () => {
  const { database, gtfs } = await fixture();
  try {
    const query = gtfs.schedule.trips.where({ trip_id: '1' }).select('trip_id');
    const stream = query.stream();
    assert.equal('then' in stream, false);
    const pending = query.all();
    assert.ok(pending instanceof Promise);
    assert.equal(Symbol.asyncIterator in pending, false);
    assert.equal('toArray' in pending, false);
    // The delete is queued after all(), without awaiting or consuming its promise.
    await gtfs.database.withKysely({
      callback: (db) =>
        db.deleteFrom('trips').where('trip_id', '=', '1').execute(),
    });
    assert.deepEqual(await pending, [{ trip_id: '1' }]);
    assert.strictEqual(await pending, await pending);
    assert.deepEqual(await query.all(), []);
    assert.deepEqual(await stream.next(), { value: undefined, done: true });
    database.exec(
      "INSERT INTO trips(source_id, trip_id, route_id, service_id) VALUES ('north','1','red','weekday')",
    );
    assert.deepEqual(await stream.next(), { value: undefined, done: true });
    for await (const _row of stream) {
      assert.fail('An exhausted stream must not replay');
    }
    const rows = [];
    for await (const row of query.stream()) {
      rows.push(row);
    }
    assert.deepEqual(rows, [{ trip_id: '1' }]);
    assert.deepEqual(await query.all(), [{ trip_id: '1' }]);
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('returning an unstarted stream does not execute or reserve the instance', async () => {
  const { database, gtfs } = await fixture();
  try {
    const unused = gtfs.gtfsPlus.directions.stream();
    assert.equal((await unused.return!()).done, true);
    assert.equal((await unused.next()).done, true);
    assert.ok(await gtfs.schedule.trips.firstOrThrow());
    const active = gtfs.schedule.trips.stream();
    assert.equal((await active.next()).done, false);
    const error = new Error('Stop manually');
    await assert.rejects(() => active.throw!(error), {
      code: 'GTFS_DATABASE_OPERATION_FAILED',
      cause: error,
    });
    assert.equal((await active.next()).done, true);
    assert.ok(await gtfs.schedule.trips.first());
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('iteration pulls rows on demand without calling the buffered driver method', async (t) => {
  const { database, gtfs } = await fixture();
  let read = 0;
  let released = false;
  const prepare = database.prepare.bind(database);
  t.mock.method(database, 'prepare', (query: string) => {
    const statement = prepare(query);
    if (query.includes('from "trips"')) {
      const iterate = statement.iterate.bind(statement);
      t.mock.method(statement, 'all', () =>
        assert.fail('Streaming must not collect the query result'),
      );
      t.mock.method(statement, 'iterate', function* (...args: unknown[]) {
        try {
          for (const row of iterate(...args)) {
            read += 1;
            yield row;
          }
        } finally {
          released = true;
        }
      });
    }
    return statement;
  });
  try {
    const rows = gtfs.schedule.trips.select('trip_id').stream();
    const iterator = rows[Symbol.asyncIterator]();
    assert.equal(read, 0);
    assert.equal((await iterator.next()).done, false);
    assert.equal(read, 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(read, 1);
    for (let index = 0; index < 8; index += 1) {
      await iterator.next();
    }
    assert.equal(read, 9);
    await iterator.return?.();
    assert.equal(released, true);
    assert.equal(read, 9);
    assert.equal((await rows.next()).done, true);
    t.mock.restoreAll();
    assert.ok(await gtfs.schedule.trips.first());
  } finally {
    await gtfs.close();
    database.close();
  }
});

test(
  'streams release the instance after early breaks, consumer failures, and empty results',
  { timeout: 5000 },
  async () => {
    const { database, gtfs } = await fixture();
    try {
      for await (const row of gtfs.schedule.trips.limit(2).stream()) {
        assert.equal(row.source_id, 'north');
        for (const operation of [
          () => gtfs.schedule.trips.first(),
          () => gtfs.schema.ensure(),
          () => gtfs.database.withKysely({ callback: () => undefined }),
          () => gtfs.schedule.trips.stream()[Symbol.asyncIterator]().next(),
        ]) {
          await assert.rejects(operation, {
            code: 'GTFS_QUERY_INVALID',
            details: { reason: 'STREAM_ACTIVE' },
          });
        }
        break;
      }
      assert.ok(await gtfs.schedule.trips.first());
      const failure = new Error('Consumer failed');
      await assert.rejects(
        async () => {
          for await (const row of gtfs.schedule.trips.stream()) {
            assert.ok(row.trip_id);
            throw failure;
          }
        },
        (error) => error === failure,
      );
      assert.ok(await gtfs.schedule.trips.first());
      for await (const row of gtfs.schedule.trips.limit(0).stream()) {
        assert.fail(`Unexpected row ${row.trip_id}`);
      }
      assert.ok(await gtfs.schedule.trips.first());
    } finally {
      await gtfs.close();
      database.close();
    }
  },
);

test(
  'close and asyncDispose cancel paused streams without closing a borrowed connection',
  { timeout: 5000 },
  async () => {
    for (const method of ['close', Symbol.asyncDispose] as const) {
      const { database, gtfs } = await fixture();
      try {
        const iterator = gtfs.schedule.trips.stream()[Symbol.asyncIterator]();
        assert.equal((await iterator.next()).done, false);
        await gtfs[method]();
        assert.equal(gtfs.isClosed, true);
        assert.equal((await iterator.next()).done, true);
        assert.equal(database.open, true);
        database.exec('DELETE FROM trips');
        await assert.rejects(
          () => gtfs.schedule.trips.stream()[Symbol.asyncIterator]().next(),
          { code: 'GTFS_INSTANCE_CLOSED' },
        );
      } finally {
        await gtfs.close();
        database.close();
      }
    }
  },
);

test('stream preflight and materialization failures release the queue and preserve diagnostics', async () => {
  const { database, gtfs } = await fixture();
  try {
    const stale = gtfs.schedule.trips.stream();
    database.exec('ALTER TABLE trips RENAME COLUMN route_id TO missing_route');
    await assert.rejects(() => stale[Symbol.asyncIterator]().next(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
    database.exec('ALTER TABLE trips RENAME COLUMN missing_route TO route_id');
    assert.ok(await gtfs.schedule.trips.first());
    await assert.rejects(
      () => gtfs.gtfsPlus.directions.stream()[Symbol.asyncIterator]().next(),
      { code: 'GTFS_EXTENSION_DISABLED' },
    );
    database.exec(`INSERT INTO fare_attributes (source_id, fare_id, price, currency_type, payment_method, transfers)
      VALUES ('north','a',123,'USD',0,0), ('north','b',456,'JPY',0,0)`);
    const prices = [];
    for await (const row of gtfs.schedule.fareAttributes
      .orderBy([{ field: 'fare_id', direction: 'asc' }])
      .select('price')
      .stream()) {
      prices.push(row);
    }
    assert.deepEqual(prices, [{ price: '1.23' }, { price: '456' }]);
    database.exec("UPDATE fare_attributes SET currency_type = 'INVALID'");
    await assert.rejects(
      () => {
        const result = gtfs.schedule.fareAttributes.select('price').stream();
        return result[Symbol.asyncIterator]().next();
      },
      (error) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
        assert.ok(error.cause instanceof TypeError);
        assert.equal(
          error.cause.message,
          'A three-letter ISO 4217 currency code is required',
        );
        return true;
      },
    );
    assert.ok(await gtfs.schedule.trips.first());
  } finally {
    await gtfs.close();
    database.close();
  }
});

test(
  'closing while a stream waits for a preceding operation releases its reservation',
  { timeout: 5000 },
  async () => {
    const { database, gtfs } = await fixture();
    let finish = () => {};
    const barrier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    try {
      const preceding = gtfs.database.withKysely({ callback: () => barrier });
      const iterator = gtfs.schedule.trips.stream()[Symbol.asyncIterator]();
      const failed = assert.rejects(() => iterator.next(), {
        code: 'GTFS_INSTANCE_CLOSED',
      });
      const closed = gtfs.close();
      finish();
      await Promise.all([preceding, failed, closed]);
      assert.equal(gtfs.isClosed, true);
    } finally {
      finish();
      await gtfs.close();
      database.close();
    }
  },
);

test(
  'closing an owned SQLite instance releases its active statement and connection',
  { timeout: 5000 },
  async (t) => {
    const close = t.mock.method(Database.prototype, 'close');
    const gtfs = new Gtfs({
      database: {},
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.ensure();
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .insertInto('routes')
            .values({ source_id: 'north', route_id: 'red', route_type: 3 })
            .execute(),
      });
      const iterator = gtfs.schedule.routes.stream()[Symbol.asyncIterator]();
      assert.equal((await iterator.next()).done, false);
      await gtfs.close();
      assert.equal(gtfs.isClosed, true);
      assert.equal(close.mock.callCount(), 1);
      assert.equal((await iterator.next()).done, true);
    } finally {
      await gtfs.close();
    }
  },
);
