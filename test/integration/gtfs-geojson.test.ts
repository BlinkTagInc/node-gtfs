import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Gtfs, GtfsErrorCode, importGtfs } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import config from '../helpers/test-config.ts';
import { verifyGeoJSONIntegration } from '../contracts/cases/geojson.ts';
describe('Gtfs GeoJSON projections', () => {
  let sqlite: Database.Database;
  let gtfs: Gtfs<GtfsDatabase>;
  let sqlStatements: string[];
  before(async () => {
    sqlStatements = [];
    sqlite = new Database(':memory:', {
      verbose(statement) {
        sqlStatements.push(String(statement));
      },
    });
    await importGtfs({
      ...config,
      database: { client: sqlite },
    });
    sqlite
      .prepare(
        'INSERT INTO stop_attributes (source_id, stop_id, stop_city) VALUES (?, ?, ?)',
      )
      .run('caltrain', '70031', 'Test City');
    gtfs = new Gtfs({
      database: {
        client: sqlite,
      },
      sources: [{ sourceId: 'caltrain' }],
      extensions: ['gtfs-plus'],
    });
  });
  after(async () => {
    await gtfs.close();
    sqlite.close();
  });
  test('returns stop points through the route selector', async () => {
    const stops = await gtfs.geojson.stops({
      routeId: 'Lo-16APR',
    });
    assert.equal(stops.type, 'FeatureCollection');
    assert.ok(stops.features.length > 0);
    assert.ok(
      stops.features.every((feature) => feature.geometry.type === 'Point'),
    );
    assert.ok(
      stops.features.every((feature) =>
        feature.properties.routes.some(
          (route) => route.route_id === 'Lo-16APR',
        ),
      ),
    );
  });
  test('retains stop attributes and source-scoped route metadata', async () => {
    const stops = await gtfs.geojson.stops({
      where: { stop_id: '70031' },
    });
    assert.equal(stops.features.length, 1);
    assert.equal(stops.features[0]!.properties.stop_city, 'Test City');
    assert.equal(stops.features[0]!.properties.source_id, 'caltrain');
    assert.ok(stops.features[0]!.properties.routes.length > 0);
  });
  test('filters stop points within coordinate bounds', async () => {
    const reference = await gtfs.schedule.stops
      .where({ stop_id: '70031' })
      .select('stop_lat', 'stop_lon')
      .first();
    if (
      reference === null ||
      reference.stop_lat === null ||
      reference.stop_lon === null
    ) {
      assert.fail('Expected the fixture stop to have coordinates');
    }
    const { stop_lat, stop_lon } = reference;
    const stops = await gtfs.geojson.stops({
      where: {
        withinBounds: {
          south: stop_lat - 0.000001,
          west: stop_lon - 0.000001,
          north: stop_lat + 0.000001,
          east: stop_lon + 0.000001,
        },
      },
    });
    assert.deepEqual(
      stops.features.map((feature) => feature.properties.stop_id),
      ['70031'],
    );
  });
  test('returns one complete shape, with its serving routes, through shape-point filters', async () => {
    const shapes = await gtfs.geojson.shapes({
      where: { shape_id: 'cal_sf_tam', shape_pt_sequence: 1 },
    });
    assert.equal(shapes.type, 'FeatureCollection');
    assert.equal(shapes.features.length, 1);
    assert.ok(
      shapes.features.every(
        (feature) => feature.geometry.type === 'LineString',
      ),
    );
    assert.ok(
      shapes.features.every(
        (feature) => feature.properties.shape_id === 'cal_sf_tam',
      ),
    );
    assert.equal(shapes.features[0]!.properties.routes.length, 3);
    assert.match(shapes.features[0]!.properties.routes[0]!.route_color!, /^#/);
    assert.ok(shapes.features[0]!.geometry.coordinates.length > 1);
    assert.deepEqual(
      shapes,
      await gtfs.geojson.shapes({ where: { shape_id: 'cal_sf_tam' } }),
    );
  });
  test('returns route lines through a typed SQL predicate', async () => {
    const routes = await gtfs.geojson.routes({
      sqlWhere: (eb) =>
        eb.exists(
          eb
            .selectFrom('trips as selected_trip')
            .select('selected_trip.trip_id')
            .whereRef('selected_trip.source_id', '=', 'routes.source_id')
            .whereRef('selected_trip.route_id', '=', 'routes.route_id')
            .where('selected_trip.shape_id', '=', 'cal_sf_tam'),
        ),
    });
    assert.equal(routes.features.length, 3);
    for (const feature of routes.features) {
      assert.equal(feature.geometry.type, 'MultiLineString');
      assert.equal(typeof feature.properties.route_id, 'string');
      assert.equal('shape_id' in feature.properties, false);
      assert.equal('_unknown_fields' in feature.properties, false);
    }
  });
  test('uses a bounded query count instead of querying per feature', async () => {
    sqlStatements.length = 0;
    const selectedStops = await gtfs.geojson.stops({
      where: { stop_id: '70031' },
    });
    const selectedStopStatementCount = sqlStatements.length;
    sqlStatements.length = 0;
    const allStops = await gtfs.geojson.stops();
    const allStopStatementCount = sqlStatements.length;
    assert.equal(selectedStops.features.length, 1);
    assert.ok(allStops.features.length > selectedStops.features.length);
    assert.equal(allStopStatementCount, selectedStopStatementCount);
    sqlStatements.length = 0;
    await gtfs.geojson.shapes({
      routeId: 'Lo-16APR',
    });
    const selectedShapeStatementCount = sqlStatements.length;
    sqlStatements.length = 0;
    await gtfs.geojson.shapes();
    const allShapeStatementCount = sqlStatements.length;
    assert.equal(allShapeStatementCount, selectedShapeStatementCount);
    sqlStatements.length = 0;
    await gtfs.geojson.routes({ where: { route_id: 'Lo-16APR' } });
    const selectedRouteStatementCount = sqlStatements.length;
    sqlStatements.length = 0;
    await gtfs.geojson.routes();
    assert.equal(sqlStatements.length, selectedRouteStatementCount);
  });
  test('evaluates root selectors once per GeoJSON request', async () => {
    const requests = [
      () =>
        gtfs.geojson.stops({
          routeId: 'Lo-16APR',
        }),
      () =>
        gtfs.geojson.shapes({
          routeId: 'Lo-16APR',
        }),
      () =>
        gtfs.geojson.routes({
          sqlWhere: (eb) =>
            eb.exists(
              eb
                .selectFrom('trips as selected_trip')
                .select('selected_trip.trip_id')
                .whereRef('selected_trip.source_id', '=', 'routes.source_id')
                .whereRef('selected_trip.route_id', '=', 'routes.route_id')
                .where('selected_trip.shape_id', '=', 'cal_sf_tam'),
            ),
        }),
    ];
    for (const request of requests) {
      sqlStatements.length = 0;
      const collection = await request();
      assert.ok(collection.features.length > 0);
      assert.equal(
        sqlStatements.filter((statement) =>
          /matching_trip|selected_trip/u.test(statement),
        ).length,
        1,
        'Association and metadata queries must not reevaluate the root relationship filter',
      );
    }
  });
  test('honors an instance source scope', async () => {
    const otherSource = new Gtfs({
      database: {
        client: sqlite,
      },
      sources: [{ sourceId: 'other' }],
    });
    try {
      assert.deepEqual(await otherSource.geojson.stops(), {
        type: 'FeatureCollection',
        features: [],
      });
      assert.deepEqual(await otherSource.geojson.shapes(), {
        type: 'FeatureCollection',
        features: [],
      });
      assert.deepEqual(await otherSource.geojson.routes(), {
        type: 'FeatureCollection',
        features: [],
      });
    } finally {
      await otherSource.close();
    }
  });
  test('rejects positional and unknown filters with query errors', async () => {
    await assert.rejects(
      async () => gtfs.geojson.stops({ stop_id: '70031' } as never),
      (error: unknown) =>
        (
          error as {
            code?: unknown;
          }
        ).code === GtfsErrorCode.QUERY_INVALID,
    );
    await assert.rejects(
      async () => gtfs.geojson.shapes({ where: { unknown: 'value' } } as never),
      (error: unknown) =>
        (
          error as {
            code?: unknown;
          }
        ).code === GtfsErrorCode.QUERY_INVALID,
    );
  });
  test('keeps the complete projection inside the instance lifecycle queue', async () => {
    const local = new Gtfs({
      database: {
        client: sqlite,
      },
      sources: [{ sourceId: 'caltrain' }],
    });
    const result = local.geojson.routes({
      where: { route_id: 'Lo-16APR' },
    });
    const closing = local.close();
    assert.equal((await result).features.length, 1);
    await closing;
    assert.equal(local.isClosed, true);
  });
});
test('preserves database shape ordering across identity batches, including Unicode IDs', async () => {
  const database = new Database(':memory:');
  const parameterCounts: number[] = [];
  const client = new Kysely({
    dialect: new SqliteDialect({ database }),
    log(event) {
      if (event.level === 'query' && event.query.sql.startsWith('select')) {
        parameterCounts.push(event.query.parameters.length);
      }
    },
  });
  const instance = new Gtfs({
    database: { client },
  });
  try {
    await instance.schema.ensure();
    const shapeIds = [
      ...Array.from({ length: 1199 }, (_, index) =>
        String(index).padStart(4, '0'),
      ),
      '\uE000',
      '🚎',
    ];
    const insert = database.prepare(
      'INSERT INTO shapes (source_id, shape_id, shape_pt_sequence, shape_pt_lon, shape_pt_lat) VALUES (?, ?, ?, ?, ?)',
    );
    database.transaction(() => {
      for (const shapeId of shapeIds.toReversed()) {
        insert.run('source', shapeId, 2, 1, 1);
        insert.run('source', shapeId, 1, 0, 0);
      }
    })();
    parameterCounts.length = 0;
    const collection = await instance.geojson.shapes({
      where: { shape_pt_sequence: 2 },
    });
    assert.ok(parameterCounts.every((count) => count <= 999));
    assert.ok(
      parameterCounts.length > 1 && parameterCounts.length < 25,
      'Lookups must be batched, not issued once per shape',
    );
    assert.deepEqual(
      collection.features.map((feature) => feature.properties.shape_id),
      shapeIds,
    );
    for (const feature of collection.features) {
      assert.deepEqual(feature.geometry.coordinates, [
        [0, 0],
        [1, 1],
      ]);
    }
  } finally {
    await instance.close();
    await client.destroy();
  }
});
test('native SQLite executes the GeoJSON projection contract', async () => {
  const sqlite = new Database(':memory:');
  try {
    await verifyGeoJSONIntegration({ client: sqlite });
  } finally {
    sqlite.close();
  }
});
test('rejects invalid GeoJSON options and filters before SQL, including empty databases', async () => {
  let queryCount = 0;
  const sqlite = new Database(':memory:', {
    verbose() {
      queryCount += 1;
    },
  });
  const gtfs = new Gtfs({ database: { client: sqlite } });
  try {
    await gtfs.schema.ensure();
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      for (const options of [
        null,
        false,
        [],
        new Date(),
        new Map(),
        { where: new Date() },
        { where: [] },
        { where: null },
        { select: [] },
        { limit: 1 },
        { bogus: true },
        { where: () => true },
        { routeId: undefined },
        { routeId: null },
        { routeId: 123 },
        { routeId: 'bad\0id' },
        { serviceDate: undefined },
        { serviceDate: '20260922' },
        { serviceDate: 20260230 },
        { sqlWhere: undefined },
        { sqlWhere: {} },
        { sqlWhere: () => true },
        { sqlWhere: () => Promise.resolve(true) },
        {
          sqlWhere: (
            eb: import('kysely').ExpressionBuilder<GtfsDatabase, 'stops'>,
          ) => eb.selectFrom('stops').selectAll(),
        },
        { where: { bogus: true } },
      ]) {
        queryCount = 0;
        await assert.rejects(
          async () => gtfs.geojson[method](options as never),
          {
            code: 'GTFS_QUERY_INVALID',
          },
        );
        assert.equal(queryCount, 0);
      }
    }
    for (const options of [
      { where: { route_id: 'red' } },
      { where: { trip_id: 'trip' } },
      { where: { service_id: 'service', stopTimes: { some: {} } } },
    ]) {
      queryCount = 0;
      await assert.rejects(async () => gtfs.geojson.stops(options as never), {
        code: 'GTFS_QUERY_INVALID',
      });
      assert.equal(queryCount, 0);
    }
    await assert.rejects(
      async () =>
        gtfs.geojson.shapes({
          where: { route_id: 'red', trips: { none: {} } },
        } as never),
      { code: 'GTFS_QUERY_INVALID' },
    );
    await assert.rejects(
      async () =>
        gtfs.geojson.routes({
          serviceDate: 20260230,
        }),
      { code: 'GTFS_QUERY_INVALID' },
    );
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});
