import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Gtfs, GtfsErrorCode } from '../../src/index.ts';
import { verifyDomainQueries } from '../contracts/cases/domain-query.ts';

test('domain queries preserve source, service, time, parent and reader semantics on SQLite', async () => {
  await verifyDomainQueries({});
});

test('domain queries reject invalid inputs and advanced reader methods before SQL', async () => {
  const gtfs = new Gtfs({ database: {}, reporting: { level: 'silent' } });
  try {
    const invalid = { code: GtfsErrorCode.QUERY_INVALID };
    for (const serviceDate of [
      20260230,
      20260922.5,
      '20260922',
      null,
      undefined,
    ]) {
      assert.throws(
        () => gtfs.query.activeTrips({ serviceDate } as never),
        invalid,
      );
      assert.throws(
        () => gtfs.query.stopTimes({ serviceDate } as never),
        invalid,
      );
      assert.throws(
        () =>
          gtfs.query.stopsForRoute({ routeId: 'red', serviceDate } as never),
        invalid,
      );
    }
    for (const value of [
      undefined,
      null,
      [],
      {},
      { routeId: undefined },
      { routeId: 1 },
      { routeId: 'red', extra: true },
    ]) {
      assert.throws(() => gtfs.query.stopsForRoute(value as never), invalid);
    }
    for (const window of [
      null,
      {},
      { field: 'arrival_time', start: '26:00:00', end: '25:00:00' },
      { field: 'stop_id', start: '25:00:00', end: '26:00:00' },
      { field: 'arrival_time', start: '25:60:00', end: '26:00:00' },
    ]) {
      assert.throws(
        () => gtfs.query.stopTimes({ serviceDate: 20260922, window } as never),
        invalid,
      );
    }
    assert.throws(
      () => gtfs.query.stops({ useParentStation: 'true' } as never),
      invalid,
    );
    assert.throws(
      () =>
        gtfs.query.stops({
          withinBounds: { south: 50, north: 40, east: 0, west: 0 },
        }),
      invalid,
    );
    const reader = gtfs.query.stops();
    for (const method of ['aggregate', 'groupBy', 'distinct', 'distinctOn']) {
      assert.equal(method in reader, false);
    }
    assert.throws(() => reader.where((() => true) as never), invalid);
    assert.throws(
      () => reader.where({ stop_id: { in: ['a'] } } as never),
      invalid,
    );
    assert.throws(
      () => reader.where({ OR: [{ stop_id: 'a' }] } as never),
      invalid,
    );
    for (const order of [
      null,
      {},
      () => true,
      [{ field: 'missing' }],
      [{ field: 'stop_id', direction: 'sideways' }],
      [{ field: 'stop_id', extra: true }],
    ]) {
      assert.throws(() => reader.orderBy(order as never), invalid);
    }
    for (const count of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => reader.limit(count), invalid);
      assert.throws(() => reader.offset(count), invalid);
    }
    await assert.rejects(
      () => Reflect.apply(reader.count, reader, [1]),
      invalid,
    );
    await assert.rejects(() => reader.first((() => true) as never), invalid);
  } finally {
    await gtfs.close();
  }
});

test('domain readers validate related tables and numeric time columns at execution', async () => {
  const gtfs = new Gtfs({ database: {}, reporting: { level: 'silent' } });
  try {
    await gtfs.schema.ensure();
    const routeStops = gtfs.query.stopsForRoute({
      routeId: 'red',
      serviceDate: 20260922,
    });
    await gtfs.database.withKysely({
      callback: (db) =>
        db.schema
          .alterTable('trips')
          .renameColumn('route_id', 'obsolete_route')
          .execute(),
    });
    await assert.rejects(async () => routeStops.all(), {
      code: GtfsErrorCode.SCHEMA_INVALID,
    });
    await assert.rejects(() => routeStops.count(), {
      code: GtfsErrorCode.SCHEMA_INVALID,
    });
    await gtfs.schema.recreate();
    const times = gtfs.query.stopTimes({
      serviceDate: 20260922,
      window: { field: 'arrival_time', start: '25:00:00', end: '26:00:00' },
    });
    await gtfs.database.withKysely({
      callback: (db) =>
        db.schema
          .alterTable('stop_times')
          .renameColumn('arrival_service_day_seconds', 'obsolete_seconds')
          .execute(),
    });
    await assert.rejects(() => times.count(), {
      code: GtfsErrorCode.SCHEMA_INVALID,
    });
    assert.equal(
      await gtfs.query.stopTimes({ serviceDate: 20260922 }).count(),
      0,
    );
  } finally {
    await gtfs.close();
  }
});
