import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlQueryCompiler,
  PostgresQueryCompiler,
  SqliteDialect,
  type CompiledQuery,
} from 'kysely';
import { loadStopsGeoJSONData } from '../../src/geojson/data.ts';
import { createStopFeatureCollection } from '../../src/geojson/geojson.ts';
import { importGtfs } from '../../src/operations.ts';
import {
  createSqliteGtfsTables,
  createSqliteGtfsIndexes,
} from '../../src/database/sqlite/schema-writer.ts';

test('stop-route associations use bounded, parameterized stop-index lookups and source-scoped trip joins', async () => {
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  const unusualId = "stop'); DROP TABLE trips; --";
  const ids = [
    ...Array.from({ length: 400 }, (_, index) => String(index)),
    unusualId,
  ];
  try {
    createSqliteGtfsTables({ database: sqlite });
    for (const sourceId of ['north', 'south']) {
      sqlite
        .prepare(
          `with recursive ids(n) as (select 0 union all select n+1 from ids where n<999)
        insert into stops(source_id,stop_id) select ?, cast(n as text) from ids`,
        )
        .run(sourceId);
      sqlite
        .prepare(
          `with recursive ids(n) as (select 0 union all select n+1 from ids where n<999)
        insert into trips(source_id,trip_id,route_id,service_id)
        select ?, cast(n as text), ?, 'daily' from ids`,
        )
        .run(sourceId, `${sourceId}-route`);
      sqlite
        .prepare(
          `with recursive ids(n) as (select 0 union all select n+1 from ids where n<9999)
        insert into stop_times(source_id,trip_id,stop_id,stop_sequence)
        select ?, cast(n/10 as text), cast(n%1000 as text), n%10 from ids`,
        )
        .run(sourceId);
      sqlite
        .prepare('insert into stops(source_id,stop_id) values (?,?)')
        .run(sourceId, unusualId);
      sqlite
        .prepare(
          'insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)',
        )
        .run(sourceId, '0', unusualId, 10);
      sqlite
        .prepare(
          'insert into routes(source_id,route_id,route_type) values (?,?,?)',
        )
        .run(sourceId, `${sourceId}-route`, 3);
    }
    createSqliteGtfsIndexes({ database: sqlite });
    const data = await loadStopsGeoJSONData({
      database,
      dialect: 'sqlite',
      enabledExtensions: [],
      sourceIds: ['north'],
      sqlWhere: (eb) => eb('stops.stop_id', 'in', ids),
    });
    assert.deepEqual(
      data.stopRoutes
        .map((row) => [row.source_id, row.stop_id, row.route_id])
        .sort(),
      ids.map((id) => ['north', id, 'north-route']).sort(),
    );
    const associationQueries = queries.filter((query) =>
      query.sql.startsWith('select distinct "stop_times"."source_id"'),
    );
    assert.deepEqual(
      associationQueries.map((query) => query.parameters.length),
      [800, 2],
    );
    assert.equal(
      associationQueries.some((query) => query.parameters.includes(unusualId)),
      true,
    );
    for (const query of associationQueries) {
      assert.equal(query.sql.includes(unusualId), false);
      for (const compiler of [
        new MysqlQueryCompiler(),
        new PostgresQueryCompiler(),
      ]) {
        const compiled = compiler.compileQuery(query.query, query.queryId);
        assert.deepEqual(compiled.parameters, query.parameters);
        assert.equal(compiled.sql.includes(unusualId), false);
        assert.equal(
          compiled.sql.split(' union all ').length,
          query.parameters.length / 2,
        );
      }
      const plan = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .all(query.parameters) as { detail: string }[];
      const details = plan.map((row) => row.detail).join('\n');
      assert.match(details, /SEARCH stop_times USING INDEX .*\(stop_id=\?\)/);
      assert.match(
        details,
        /SEARCH trips USING INDEX .*\(source_id=\? AND trip_id=\?\)/,
      );
      assert.doesNotMatch(
        details,
        /SCAN stop_times|stop_times.*\(source_id=\?\)/,
      );
    }

    // Indexes are an optimization, not a requirement of query-facing preflight.
    sqlite.exec(
      'drop index idx_stop_times_stop_id_arrival_service_day_seconds',
    );
    const withoutIndex = await loadStopsGeoJSONData({
      database,
      dialect: 'sqlite',
      enabledExtensions: [],
      sourceIds: ['north'],
      where: { stop_id: unusualId },
    });
    assert.deepEqual(withoutIndex.stopRoutes, [
      { source_id: 'north', stop_id: unusualId, route_id: 'north-route' },
    ]);
  } finally {
    await database.destroy();
  }
});

test('stop-route lookups stay indexed with sampled statistics from a Schedule import', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-geojson-plan-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ids = Array.from({ length: 100 }, (_, index) => String(index));
  const tripIds = Array.from({ length: 1000 }, (_, index) => String(index));
  const files = {
    'stops.txt':
      'stop_id,stop_name,stop_lat,stop_lon\n' +
      ids.map((id) => `${id},Stop ${id},0,0\n`).join(''),
    'routes.txt': 'route_id,route_type\nroute,3\n',
    'trips.txt':
      'trip_id,route_id,service_id\n' +
      tripIds.map((id) => `${id},route,daily\n`).join(''),
    'stop_times.txt':
      'trip_id,stop_id,stop_sequence\n' +
      tripIds
        .flatMap((tripId) => ids.map((id) => `${tripId},${id},${id}\n`))
        .join(''),
  };
  for (const [filename, contents] of Object.entries(files)) {
    await writeFile(path.join(directory, filename), contents);
  }
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  try {
    await importGtfs({
      database: { client: sqlite },
      sources: [
        {
          sourceId: 'north',
          schedule: {
            path: directory,
            import: { validation: { mode: 'off' } },
          },
        },
      ],
      reporting: { level: 'silent' },
    });
    // Keep the sampled statistics produced by import, without a full ANALYZE.
    const selectedIds = ids.slice(0, 95);
    const data = await loadStopsGeoJSONData({
      database,
      dialect: 'sqlite',
      enabledExtensions: [],
      sourceIds: ['north'],
      sqlWhere: (eb) => eb('stops.stop_id', 'in', selectedIds),
    });
    assert.deepEqual(
      data.stopRoutes
        .map((row) => [row.source_id, row.stop_id, row.route_id])
        .sort(),
      selectedIds.map((id) => ['north', id, 'route']).sort(),
    );
    const associations = queries.filter((query) =>
      query.sql.startsWith('select distinct "stop_times"."source_id"'),
    );
    assert.equal(associations.length, 1);
    for (const query of associations) {
      const plan = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .all(query.parameters) as { detail: string }[];
      const details = plan.map((row) => row.detail).join('\n');
      assert.match(details, /SEARCH stop_times USING INDEX .*\(stop_id=\?\)/);
      assert.doesNotMatch(
        details,
        /SCAN stop_times|stop_times.*\(source_id=\?\)/,
      );
    }
  } finally {
    await database.destroy();
  }
});

test('whole-source stop associations exclude dangling references and preserve source scope', async () => {
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  try {
    createSqliteGtfsTables({ database: sqlite });
    for (const sourceId of ['north', 'south']) {
      for (const stopId of ['shared', 'unserved']) {
        sqlite
          .prepare('insert into stops(source_id,stop_id) values (?,?)')
          .run(sourceId, stopId);
      }
      for (const [tripId, routeId, stopId] of [
        ['trip', `${sourceId}-route`, 'shared'],
        ['other', `${sourceId}-other`, 'shared'],
        ['orphan', `${sourceId}-orphan`, 'missing'],
      ]) {
        sqlite
          .prepare(
            'insert into routes(source_id,route_id,route_type) values (?,?,3)',
          )
          .run(sourceId, routeId);
        sqlite
          .prepare(
            'insert into trips(source_id,trip_id,route_id,service_id) values (?,?,?,?)',
          )
          .run(sourceId, tripId, routeId, 'daily');
        for (const sequence of [1, 2]) {
          sqlite
            .prepare(
              'insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)',
            )
            .run(sourceId, tripId, stopId, sequence);
        }
      }
    }
    // A stop present only in the other source must not satisfy the stops join.
    sqlite
      .prepare('insert into stops(source_id,stop_id) values (?,?)')
      .run('south', 'missing');
    sqlite
      .prepare(
        'insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)',
      )
      .run('north', 'missing-trip', 'shared', 1);
    createSqliteGtfsIndexes({ database: sqlite });
    const options = {
      database,
      dialect: 'sqlite' as const,
      enabledExtensions: [],
    };
    for (const sourceIds of [['north'], ['south'], null, [], ['absent']]) {
      queries.length = 0;
      const all = await loadStopsGeoJSONData({
        ...options,
        sourceIds,
        where: {},
      });
      const associationQueries = queries.filter((query) =>
        query.sql.startsWith('select "stop_routes"."source_id"'),
      );
      assert.equal(
        associationQueries.length,
        new Set(all.stops.map((stop) => stop.source_id)).size,
      );
      for (const query of associationQueries) {
        assert.equal(query.parameters.length, 1);
        assert.equal(query.sql.includes('union all'), false);
        for (const compiler of [
          new MysqlQueryCompiler(),
          new PostgresQueryCompiler(),
        ]) {
          const compiled = compiler.compileQuery(query.query, query.queryId);
          assert.deepEqual(compiled.parameters, query.parameters);
          assert.match(compiled.sql, /inner join/);
        }
      }
      const batched = await loadStopsGeoJSONData({
        ...options,
        sourceIds,
        sqlWhere: (eb) =>
          eb('stops.stop_id', 'in', ['shared', 'unserved', 'missing']),
      });
      const ordered = (rows: readonly unknown[]) =>
        rows.map((row) => JSON.stringify(row)).sort();
      assert.deepEqual(ordered(all.stopRoutes), ordered(batched.stopRoutes));
      assert.deepEqual(ordered(all.routes), ordered(batched.routes));
      assert.deepEqual(all.stops, batched.stops);
      if (sourceIds?.[0] === 'north') {
        assert.deepEqual(
          ordered(all.stopRoutes),
          ordered([
            { source_id: 'north', stop_id: 'shared', route_id: 'north-route' },
            { source_id: 'north', stop_id: 'shared', route_id: 'north-other' },
          ]),
        );
        assert.equal(all.stops.length, 2);
      }
    }
  } finally {
    await database.destroy();
  }
});

test('whole-source parent associations match filtered reads for direct station routes, platform unions and invalid hierarchies', async (t) => {
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  t.after(() => database.destroy());
  createSqliteGtfsTables({ database: sqlite });
  const locations: Array<[string, number | null, string | null]> = [
    ['station', 1, null],
    ['platform', 0, 'station'],
    ['null-platform', null, 'station'],
    ['entrance', 2, 'station'],
    ['node', 3, 'station'],
    ['boarding', 4, 'platform'],
    ['standalone', 0, null],
    ['missing-parent', 0, 'absent'],
    ['wrong-parent', 0, 'standalone'],
    ['cycle-a', 0, 'cycle-b'],
    ['cycle-b', 0, 'cycle-a'],
    ["quote'); --", 0, 'station'],
    ['invalid-station', 1, null],
    ['invalid-child', 0, 'invalid-station'],
  ];
  for (const sourceId of ['north', 'south']) {
    for (const [stopId, locationType, parent] of locations) {
      sqlite
        .prepare(
          'insert into stops(source_id,stop_id,location_type,parent_station,stop_lat,stop_lon) values (?,?,?,?,?,?)',
        )
        .run(
          sourceId,
          stopId,
          locationType,
          parent,
          stopId === 'invalid-station' ? null : 1,
          2,
        );
    }
    for (const [index, stopId] of [
      ...locations.map(([id]) => id),
      'dangling',
    ].entries()) {
      const routeId = `${sourceId}-${stopId}`;
      sqlite
        .prepare(
          'insert into routes(source_id,route_id,route_type) values (?,?,3)',
        )
        .run(sourceId, routeId);
      sqlite
        .prepare(
          'insert into trips(source_id,trip_id,route_id,service_id) values (?,?,?,?)',
        )
        .run(sourceId, String(index), routeId, 'daily');
      for (const sequence of [1, 2]) {
        sqlite
          .prepare(
            'insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)',
          )
          .run(sourceId, String(index), stopId, sequence);
      }
    }
    // A direct station route can also serve multiple child platforms.
    for (const [sequence, stopId] of ['platform', 'null-platform'].entries()) {
      sqlite
        .prepare(
          'insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)',
        )
        .run(sourceId, '0', stopId, sequence + 3);
    }
  }
  sqlite
    .prepare('insert into stops(source_id,stop_id) values (?,?)')
    .run('south', 'dangling');
  createSqliteGtfsIndexes({ database: sqlite });
  const order = (rows: readonly unknown[]) =>
    rows.map((row) => JSON.stringify(row)).sort();
  for (const sourceIds of [['north'], ['south'], null, [], ['absent']]) {
    for (const useParentStation of [false, true]) {
      const options = {
        database,
        dialect: 'sqlite' as const,
        enabledExtensions: [],
        sourceIds,
        useParentStation,
      };
      queries.length = 0;
      const whole = await loadStopsGeoJSONData({ ...options, where: {} });
      const associations = queries.filter((query) =>
        query.sql.startsWith('select "stop_routes"."source_id"'),
      );
      assert.equal(
        associations.length,
        new Set(whole.stops.map((stop) => stop.source_id)).size,
      );
      const filtered = await loadStopsGeoJSONData({
        ...options,
        sqlWhere: (eb) =>
          eb('stops.stop_id', 'in', [
            ...locations.map(([id]) => id),
            'dangling',
          ]),
      });
      assert.deepEqual(whole.stops, filtered.stops);
      assert.deepEqual(
        createStopFeatureCollection(whole),
        createStopFeatureCollection(filtered),
      );
      if (useParentStation) {
        assert.deepEqual(order(whole.stopRoutes), order(filtered.stopRoutes));
        assert.deepEqual(order(whole.routes), order(filtered.routes));
      }
      if (sourceIds?.[0] === 'north' && useParentStation) {
        const routes = whole.stopRoutes
          .filter((row) => row.stop_id === 'station')
          .map((row) => row.route_id);
        assert.deepEqual(
          [...new Set(routes)].sort(),
          [
            'north-station',
            'north-platform',
            'north-null-platform',
            "north-quote'); --",
          ].sort(),
        );
        assert.equal(
          whole.stopRoutes.some((row) => row.source_id !== 'north'),
          false,
        );
      }
    }
  }
});

test('filtered parent routes include unselected siblings in bounded indexed batches', async (t) => {
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  t.after(() => database.destroy());
  createSqliteGtfsTables({ database: sqlite });
  const unusualId = "sibling'); --";
  const childIds = [
    ...Array.from({ length: 400 }, (_, index) => `child-${index}`),
    unusualId,
  ];
  for (const sourceId of ['north', 'south']) {
    sqlite
      .prepare(
        `insert into stops(source_id,stop_id,location_type,stop_lat,stop_lon)
        values (?,'station',1,1,2)`,
      )
      .run(sourceId);
    for (const [index, stopId] of [
      ...childIds,
      'entrance',
      'station',
    ].entries()) {
      const routeId = `${sourceId}-${index === 0 ? 'selected' : stopId === 'station' ? 'direct' : stopId === 'entrance' ? 'excluded' : 'sibling'}`;
      if (stopId !== 'station') {
        sqlite
          .prepare(
            `insert into stops(source_id,stop_id,parent_station,location_type,stop_lat,stop_lon)
            values (?,?,'station',?,1,2)`,
          )
          .run(
            sourceId,
            stopId,
            stopId === 'entrance' ? 2 : index % 2 === 0 ? 0 : null,
          );
      }
      sqlite
        .prepare(
          `insert or ignore into routes(source_id,route_id,route_type) values (?,?,3)`,
        )
        .run(sourceId, routeId);
      sqlite
        .prepare(
          `insert into trips(source_id,trip_id,route_id,service_id) values (?,?,?,'daily')`,
        )
        .run(sourceId, String(index), routeId);
      for (const sequence of [1, 2]) {
        sqlite
          .prepare(
            `insert into stop_times(source_id,trip_id,stop_id,stop_sequence) values (?,?,?,?)`,
          )
          .run(sourceId, String(index), stopId, sequence);
      }
    }
  }
  createSqliteGtfsIndexes({ database: sqlite });
  const data = await loadStopsGeoJSONData({
    database,
    dialect: 'sqlite',
    enabledExtensions: [],
    sourceIds: ['north'],
    useParentStation: true,
    where: { stop_id: 'child-0' },
  });
  assert.deepEqual(
    data.stops.map((stop) => stop.stop_id),
    ['station'],
  );
  assert.deepEqual(
    data.stopRoutes
      .map((row) => [row.source_id, row.stop_id, row.route_id])
      .sort(),
    ['direct', 'selected', 'sibling'].map((route) => [
      'north',
      'station',
      `north-${route}`,
    ]),
  );
  const associations = queries.filter((query) =>
    query.sql.startsWith('select distinct "stop_times"."source_id"'),
  );
  assert.deepEqual(
    associations.map((query) => query.parameters.length),
    [2, 800, 2],
  );
  assert.ok(associations.some((query) => query.parameters.includes(unusualId)));
  for (const query of associations) {
    assert.equal(query.sql.includes(unusualId), false);
    const plan = sqlite
      .prepare(`explain query plan ${query.sql}`)
      .all(query.parameters) as { detail: string }[];
    const details = plan.map((row) => row.detail).join('\n');
    assert.match(details, /SEARCH stop_times USING INDEX .*\(stop_id=\?\)/);
    assert.doesNotMatch(
      details,
      /SCAN stop_times|stop_times.*\(source_id=\?\)/,
    );
    for (const compiler of [
      new MysqlQueryCompiler(),
      new PostgresQueryCompiler(),
    ]) {
      const compiled = compiler.compileQuery(query.query, query.queryId);
      assert.deepEqual(compiled.parameters, query.parameters);
    }
  }
});
