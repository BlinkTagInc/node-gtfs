import { sql } from 'kysely';
import { stopsMatchingPattern } from '../helpers/advanced-filter-recipes.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  foldGtfsText,
  getCaseFoldColumnName,
} from '../../src/values/case-fold.ts';
import { Gtfs } from '../../src/index.ts';

test('query builders preserve source scope, selection, comparisons, relations and counts', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(`
      INSERT INTO routes (source_id, route_id, route_type) VALUES ('north','red',3),('north','blue',2),('south','red',3);
      INSERT INTO trips (source_id, trip_id, route_id, service_id) VALUES ('north','one','red','weekday'),('north','two','red','weekday'),('north','three','blue','weekday'),('south','one','red','weekday');
      INSERT INTO stop_times (source_id, trip_id, stop_sequence, arrival_time, departure_time) VALUES ('north','one',1,'9:00:00','10:00:00'),('north','one',2,'100:00:00','100:00:00');
    `);
    const trips = gtfs.schedule.trips.where({ route_id: 'red' });
    assert.ok(Object.isFrozen(trips));
    assert.deepEqual(
      await trips
        .select('trip_id')
        .orderBy([{ field: 'trip_id', direction: 'asc' }])
        .all(),
      [{ trip_id: 'one' }, { trip_id: 'two' }],
    );
    assert.equal((await trips.first({ trip_id: 'two' }))?.trip_id, 'two');
    assert.equal(await trips.first({ trip_id: 'missing' }), null);
    assert.deepEqual(
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .selectFrom('trips')
            .innerJoin('routes', (join) =>
              join
                .onRef('routes.source_id', '=', 'trips.source_id')
                .onRef('routes.route_id', '=', 'trips.route_id'),
            )
            .where('trips.source_id', '=', 'north')
            .where('routes.route_type', '=', 2)
            .select('trips.trip_id')
            .execute(),
      }),
      [{ trip_id: 'three' }],
    );
    assert.deepEqual(
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .selectFrom('stop_times')
            .where('source_id', '=', 'north')
            .whereRef(
              'departure_service_day_seconds',
              '>',
              'arrival_service_day_seconds',
            )
            .where('stop_sequence', '!=', 2)
            .select('stop_sequence')
            .execute(),
      }),
      [{ stop_sequence: 1 }],
    );
    assert.deepEqual(
      await gtfs.schedule.stopTimes
        .orderBy([{ field: 'arrival_time', direction: 'asc' }])
        .select('arrival_time')
        .all(),
      [{ arrival_time: '9:00:00' }, { arrival_time: '100:00:00' }],
    );
    assert.equal(await trips.limit(1).count(), 1);
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('first respects an explicit zero limit, including with an inline filter', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(
      "INSERT INTO routes (source_id, route_id, route_type) VALUES ('a','red',3)",
    );
    const empty = gtfs.schedule.routes.limit(0);
    assert.deepEqual(await empty.all(), []);
    assert.equal(await empty.first(), null);
    assert.equal(await empty.first({ route_id: 'red' }), null);
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('count preflight ignores row projections but requires columns used by other query stages', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(`
      DROP INDEX idx_stop_times_stop_id_arrival_service_day_seconds;
      ALTER TABLE stop_times DROP COLUMN arrival_service_day_seconds;
    `);
    database.exec(
      "INSERT INTO stop_times (source_id, trip_id, stop_sequence, arrival_time) VALUES ('a','one',1,'9:00:00')",
    );
    const times = gtfs.schedule.stopTimes.select('arrival_service_day_seconds');
    assert.equal(await times.count(), 1);
    assert.equal(await times.limit(0).count(), 0);
    assert.equal(
      await times
        .orderBy([{ field: 'arrival_time' }])
        .orderBy([])
        .count(),
      1,
    );
    const requiresGeneratedColumn = [
      () => times.all(),
      () => times.first(),
      () => times.limit(0).first(),
      () => times.where({ arrival_time: '08:00:00' }).count(),
      () => times.orderBy([{ field: 'arrival_time' }]).count(),
    ];
    for (const execute of requiresGeneratedColumn) {
      await assert.rejects(execute, { code: 'GTFS_SCHEMA_INVALID' });
    }
    database.exec('ALTER TABLE stop_times DROP COLUMN arrival_time');
    await assert.rejects(() => times.count(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('builders snapshot filters and reject malformed callbacks before SQL', async () => {
  let statements = 0;
  const database = new Database(':memory:', {
    verbose() {
      statements += 1;
    },
  });
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    database.exec(
      "INSERT INTO routes (source_id, route_id, route_type) VALUES ('a','red',3),('a','blue',2)",
    );
    database.exec(
      "INSERT INTO stops (source_id, stop_id, stop_lat, stop_lon) VALUES ('a', 'inside', 0, 0), ('a', 'outside', 20, 20)",
    );
    const bounds = { south: -1, west: -1, north: 1, east: 1 };
    const spatial = { withinBounds: bounds };
    const bounded = gtfs.schedule.stops.where(spatial);
    bounds.north = 30;
    bounds.east = 30;
    spatial.withinBounds = { south: 40, west: 40, north: 50, east: 50 };
    assert.deepEqual(await bounded.select('stop_id').all(), [
      { stop_id: 'inside' },
    ]);
    const equality = { route_id: 'red' };
    const byEquality = gtfs.schedule.routes.where(equality);
    equality.route_id = 'blue';
    const order: { field: 'route_id'; direction?: 'asc' | 'desc' }[] = [
      { field: 'route_id' },
    ];
    const ordered = gtfs.schedule.routes.select('route_id').orderBy(order);
    order[0]!.direction = 'desc';
    order.length = 0;
    assert.deepEqual(await ordered.all(), [
      { route_id: 'blue' },
      { route_id: 'red' },
    ]);
    assert.deepEqual(
      await ordered
        .orderBy([])
        .orderBy([{ field: 'route_id', direction: 'desc' }])
        .all(),
      [{ route_id: 'red' }, { route_id: 'blue' }],
    );
    for (const query of [byEquality]) {
      assert.deepEqual(await query.select('route_id').all(), [
        { route_id: 'red' },
      ]);
    }
    const invalidQueries = [
      ...[
        null,
        [],
        () => {
          assert.fail('Filter callbacks must not execute');
        },
        { route_type: '3' },
        { route_id: { in: ['red'] } },
        { trips: { some: {} } },
        { OR: [] },
      ].flatMap((filter) => [
        () => gtfs.schedule.routes.where(filter as never).all(),
        () => gtfs.schedule.routes.where(filter as never).count(),
        () => gtfs.schedule.routes.first(filter as never),
        () => gtfs.schedule.routes.firstOrThrow(filter as never),
        () =>
          gtfs.schedule.routes
            .where(filter as never)
            .stream()
            .next(),
      ]),
      () => gtfs.schedule.routes.orderBy([{ field: 'trip_id' }] as never).all(),
      () => Reflect.apply(gtfs.schedule.routes.first, undefined, [{}, {}]),
      () => gtfs.schedule.routes.first(undefined as never),
      () => gtfs.schedule.routes.firstOrThrow(undefined as never),
      () =>
        Reflect.apply(gtfs.schedule.routes.firstOrThrow, undefined, [{}, {}]),
      () => Reflect.apply(gtfs.schedule.routes.all, undefined, [{}]),
      () => Reflect.apply(gtfs.schedule.routes.stream, undefined, [{}]).next(),
      () => Reflect.apply(gtfs.schedule.routes.count, undefined, [{}]),
      ...[
        null,
        {},
        new Array(1),
        [null],
        [{ field: 'route_id', direction: 'up' }],
        [{ field: 'route_id', direction: null }],
        [{ field: 'route_id', extra: true }],
      ].map((order) => () => gtfs.schedule.routes.orderBy(order as never)),
      () =>
        gtfs.schedule.routes.orderBy((() => {
          assert.fail('Sorting callbacks must not execute');
        }) as never),
    ];
    for (const query of invalidQueries) {
      const before = statements;
      await assert.rejects(async () => query(), { code: 'GTFS_QUERY_INVALID' });
      assert.equal(statements, before);
    }
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('like patterns preserve case and escape SQL and SQLite wildcard characters', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    const insert = database.prepare(
      `INSERT INTO stops (source_id, stop_id, stop_name, ${getCaseFoldColumnName('stop_name')}) VALUES (?, ?, ?, ?)`,
    );
    for (const [index, name] of [
      'Market',
      'market',
      'MarkX',
      '100%_done',
      '[*?]!',
      'a\\b',
      'Å',
      '',
    ].entries()) {
      insert.run('a', String(index), name, foldGtfsText(name));
    }
    for (const [sqlite, sqlPattern, expected] of [
      ['Mark*', 'Mark%', ['0', '2']],
      ['Mark?t', 'Mark_t', ['0']],
      ['100%_done', '100!%!_done', ['3']],
      ['[[][*][?]]!', '[*?]!!', ['4']],
      ['a\\b', 'a\\b', ['5']],
      ['?', '_', ['6']],
      ['', '', ['7']],
    ] as const) {
      assert.deepEqual(
        await gtfs.database.withKysely({
          callback: (db) =>
            stopsMatchingPattern(db, gtfs.database.dialect, 'a', {
              sqlite,
              sql: sqlPattern,
            })
              .orderBy('stop_id')
              .execute(),
        }),
        expected.map((stop_id) => ({ stop_id })),
      );
    }
    assert.deepEqual(
      await gtfs.database.withKysely({
        callback: (db) =>
          db
            .selectFrom('stops')
            .where('source_id', '=', 'a')
            .where(
              sql<boolean>`${sql.ref('_node_gtfs_casefold_stop_name')} like ${'mark_t'}`,
            )
            .select('stop_id')
            .orderBy('stop_id')
            .execute(),
      }),
      [{ stop_id: '0' }, { stop_id: '1' }],
    );
  } finally {
    await gtfs.close();
    database.close();
  }
});

test('query results execute against current schema and lifecycle state, not builder creation time', async () => {
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.ensure();
    const query = gtfs.schedule.routes.select('route_id');
    assert.deepEqual(await query.all(), []);
    assert.equal(await query.count(), 0);
    database.exec(
      "INSERT INTO routes (source_id, route_id, route_type) VALUES ('a','red',3)",
    );
    assert.equal(await query.count(), 1);
    const stale = query.stream();
    database.exec('DROP TABLE routes');
    await assert.rejects(() => query.count(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
    await assert.rejects(() => stale.next(), {
      code: 'GTFS_SCHEMA_INVALID',
    });
    const closed = query.stream();
    await gtfs.close();
    await assert.rejects(() => query.count(), {
      code: 'GTFS_INSTANCE_CLOSED',
    });
    await assert.rejects(() => closed.next(), {
      code: 'GTFS_INSTANCE_CLOSED',
    });
  } finally {
    await gtfs.close();
    database.close();
  }
});
