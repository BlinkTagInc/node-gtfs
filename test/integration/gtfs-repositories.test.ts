import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Gtfs, GtfsErrorCode } from '../../src/index.ts';
import { generatedRepositoryDefinitions } from '../../src/generated/repositories.ts';
import {
  compiledTableRegistry,
  compiledTables,
} from '../../src/schema/table-registry.ts';
const namespaceByExtension = {
  'gtfs-schedule': 'schedule',
  'gtfs-realtime': 'realtime',
  'gtfs-plus': 'gtfsPlus',
  'gtfs-ride': 'gtfsRide',
  'gtfs-to-html': 'gtfsToHtml',
  tods: 'tods',
  'tods-v1': 'todsV1',
  tides: 'tides',
} as const;
function filenameProperty(filename: string): string {
  return filename
    .replace(/\.(?:txt|csv|geojson)$/u, '')
    .replace(/_([a-z\d])/gu, (_match, character: string) =>
      character.toUpperCase(),
    );
}
describe('generated Gtfs repositories', () => {
  test('installs one immutable asynchronous repository for every table', async () => {
    const gtfs = new Gtfs({ database: {} });
    try {
      assert.equal(
        generatedRepositoryDefinitions.length,
        compiledTables.length,
      );
      const generatedPaths = new Set<string>();
      for (const definition of generatedRepositoryDefinitions) {
        const table = compiledTableRegistry[definition.registryKey];
        assert.equal(
          definition.propertyPath[0],
          namespaceByExtension[table.specification],
        );
        if (table.filename !== null) {
          assert.deepEqual(definition.propertyPath, [
            namespaceByExtension[table.specification],
            filenameProperty(table.filename),
          ]);
        }
        const generatedPath = definition.propertyPath.join('.');
        assert.equal(generatedPaths.has(generatedPath), false, generatedPath);
        generatedPaths.add(generatedPath);
        let repository: unknown = gtfs;
        for (const property of definition.propertyPath) {
          repository = (repository as Record<string, unknown>)[property];
        }
        const typedRepository = repository as {
          tableName: string;
          all: unknown;
        };
        const installedTable = compiledTables.find(
          (candidate) => candidate.tableName === typedRepository.tableName,
        )!;
        assert.equal(typedRepository.tableName, installedTable.tableName);
        assert.equal(typeof typedRepository.all, 'function');
        assert.equal('aggregate' in typedRepository, false, generatedPath);
        assert.equal('groupBy' in typedRepository, false, generatedPath);
        assert.equal('distinct' in typedRepository, false, generatedPath);
        assert.equal('distinctOn' in typedRepository, false, generatedPath);
        assert.equal(Object.isFrozen(typedRepository), true);
      }
      for (const namespace of Object.values(namespaceByExtension)) {
        assert.equal(Object.isFrozen(gtfs[namespace]), true);
      }
      assert.equal(gtfs.schedule.agency.tableName, 'agency');
      assert.equal(gtfs.schedule.routes.tableName, 'routes');
      assert.equal(gtfs.schedule.stopTimes.tableName, 'stop_times');
      assert.equal(gtfs.realtime.alerts.tableName, 'alerts');
      assert.equal(gtfs.gtfsPlus.directions.tableName, 'directions');
      assert.equal(gtfs.gtfsRide.boardAlight.tableName, 'board_alight');
      assert.equal(gtfs.gtfsToHtml.timetables.tableName, 'timetables');
      assert.equal(gtfs.tods.runEvents.tableName, 'run_events');
      assert.equal(gtfs.todsV1.runEvent.tableName, 'run_event');
      assert.equal(gtfs.tides.vehicles.tableName, 'vehicles');
      assert.deepEqual(
        Object.keys(gtfs.realtime).sort(),
        [
          'alertEntitySelectors',
          'alertTimeRanges',
          'alerts',
          'cleanup',
          'persistence',
          'shapes',
          'stops',
          'tripModifications',
          'tripUpdateStopTimeUpdates',
          'tripUpdates',
          'refresh',
          'vehiclePositions',
        ].sort(),
      );
      assert.equal(Object.isFrozen(gtfs.realtime.persistence), true);
    } finally {
      await gtfs.close();
    }
  });
  test('materializes all, first, and count aggregate results', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      extensions: ['gtfs-realtime'],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: (database) =>
          sql`insert into routes
          (source_id, route_id, route_short_name, route_type)
          values
            ('north', 'red', 'Red', 1),
            ('north', 'blue', 'Blue', 1),
            ('south', 'red', 'Other Red', 1)`.execute(database),
      });
      const rows = await gtfs.schedule.routes
        .where({ route_type: 1 })
        .select('route_id', 'route_short_name')
        .orderBy([{ field: 'route_short_name', direction: 'asc' }])
        .limit(1)
        .offset(1)
        .all();
      assert.deepEqual(rows, [{ route_id: 'red', route_short_name: 'Red' }]);
      assert.deepEqual(
        await gtfs.schedule.routes
          .where({ route_id: 'blue' })
          .select('route_id')
          .first(),
        { route_id: 'blue' },
      );
      assert.equal(
        await gtfs.schedule.routes.where({ route_type: 1 }).count(),
        2,
      );
      assert.equal(
        await gtfs.schedule.routes.where({ route_id: 'missing' }).count(),
        0,
      );
    } finally {
      await gtfs.close();
    }
  });
  test('rejects unknown and malformed repository options before querying', async () => {
    const sqlite = new Database(':memory:');
    let queryCount = 0;
    const database = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
      log() {
        queryCount += 1;
      },
    });
    const gtfs = new Gtfs({
      database: { client: database },
      reporting: { level: 'silent' },
    });
    const invalidCalls = [
      () =>
        Reflect.apply(gtfs.schedule.routes.all, undefined, [{ bogus: true }]),
      () => gtfs.schedule.routes.first({ limit: 5 } as never),
      () =>
        Reflect.apply(gtfs.schedule.routes.all, undefined, [
          { select: ['route_id'] },
        ]),
      () => gtfs.schedule.routes.select('route_id', 'route_id').all(),
      () => gtfs.schedule.routes.where([] as never).all(),
      () => gtfs.schedule.routes.where('red' as never).count(),
      () => gtfs.schedule.routes.orderBy({} as never).all(),
      () => gtfs.schedule.routes.orderBy([null] as never).all(),
      () => gtfs.schedule.routes.orderBy((() => 'asc') as never).all(),
    ];
    try {
      for (const call of invalidCalls) {
        await assert.rejects(
          async () => call(),
          (error: unknown) =>
            (
              error as {
                code?: unknown;
              }
            ).code === GtfsErrorCode.QUERY_INVALID,
        );
      }
      assert.equal(queryCount, 0);
    } finally {
      await gtfs.close();
      await database.destroy();
    }
  });
  test('filters stops within inclusive coordinate bounds', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: (database) =>
          sql`insert into stops
          (source_id, stop_id, stop_lat, stop_lon)
          values
            ('north', 'center', 37.75, -122.4),
            ('north', 'north-edge', 37.8, -122.4),
            ('north', 'outside', 38, -122.4),
            ('north', 'dateline-east', 0, 179.5),
            ('north', 'dateline-west', 0, -179.5),
            ('north', 'greenwich', 0, 0),
            ('north', 'missing-coordinates', null, null),
            ('south', 'other-source', 37.75, -122.4)`.execute(database),
      });
      const viewport = {
        south: 37.7,
        west: -122.5,
        north: 37.8,
        east: -122.3,
      };
      assert.deepEqual(
        await gtfs.schedule.stops
          .where({ withinBounds: viewport })
          .select('stop_id')
          .orderBy([{ field: 'stop_id', direction: 'asc' }])
          .all(),
        [{ stop_id: 'center' }, { stop_id: 'north-edge' }],
      );
      assert.deepEqual(
        await gtfs.schedule.stops
          .where({ stop_id: 'center', withinBounds: viewport })
          .select('stop_id')
          .first(),
        { stop_id: 'center' },
      );
      assert.equal(
        await gtfs.schedule.stops.where({ withinBounds: viewport }).count(),
        2,
      );
      assert.deepEqual(
        await gtfs.schedule.stops
          .where({
            withinBounds: { south: -1, west: 179, north: 1, east: -179 },
          })
          .select('stop_id')
          .orderBy([{ field: 'stop_id', direction: 'asc' }])
          .all(),
        [{ stop_id: 'dateline-east' }, { stop_id: 'dateline-west' }],
      );
    } finally {
      await gtfs.close();
    }
  });
  test('rejects invalid stop coordinate bounds', async () => {
    const gtfs = new Gtfs({
      database: {},
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      for (const withinBounds of [
        { south: -91, west: -10, north: 10, east: 10 },
        { south: -10, west: -181, north: 10, east: 10 },
        { south: -10, west: -10, north: Number.NaN, east: 10 },
        { south: 10, west: -10, north: -10, east: 10 },
        { south: -10, west: -10, north: 10 },
        { south: -10, west: -10, north: 10, east: 10, radius: 5 },
      ]) {
        await assert.rejects(
          async () =>
            gtfs.schedule.stops.where({ withinBounds } as never).all(),
          (error: unknown) =>
            (
              error as {
                code?: unknown;
              }
            ).code === GtfsErrorCode.QUERY_INVALID,
        );
      }
    } finally {
      await gtfs.close();
    }
  });

  test('rejects invalid relationship operators before issuing a query', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await assert.rejects(
        async () =>
          gtfs.schedule.routes
            .where({ trips: { is: { route_id: 'red' } } } as never)
            .all(),
        (error: unknown) => {
          const candidate = error as {
            code?: unknown;
            message?: unknown;
          };
          return (
            candidate.code === GtfsErrorCode.QUERY_INVALID &&
            typeof candidate.message === 'string' &&
            candidate.message.includes('use database.withKysely()')
          );
        },
      );
    } finally {
      await gtfs.close();
    }
  });
  test('identifies the exact filter that requires an object', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      for (const [query, message, field] of [
        [
          () => gtfs.schedule.routes.where({ trips: null } as never).all(),
          'where() objects support field equality and GTFS semantic filters only; use database.withKysely() for operators, boolean groups, or relationships',
          'trips',
        ],
        [
          () =>
            gtfs.schedule.stops.where({ withinBounds: null } as never).all(),
          '`withinBounds` must be a coordinate-bounds object',
          'withinBounds',
        ],
      ] as const) {
        await assert.rejects(
          async () => query(),
          (error: unknown) => {
            const candidate = error as {
              code?: unknown;
              message?: unknown;
              details?: Record<string, unknown>;
            };
            return (
              candidate.code === GtfsErrorCode.QUERY_INVALID &&
              candidate.message === message &&
              candidate.details?.field === field
            );
          },
        );
      }
    } finally {
      await gtfs.close();
    }
  });

  test('domain queries report missing related tables as invalid schema', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: (database) => sql`drop table stop_times`.execute(database),
      });
      await assert.rejects(
        async () => gtfs.query.stopsForRoute({ routeId: 'red' }).all(),
        (error: unknown) =>
          (
            error as {
              code?: unknown;
            }
          ).code === GtfsErrorCode.SCHEMA_INVALID,
      );
    } finally {
      await gtfs.close();
    }
  });
});
