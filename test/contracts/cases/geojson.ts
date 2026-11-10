import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import { verifyGeoJSONBatchIntegration } from '../../helpers/geojson-batch-fixture.ts';
import { verifyGeoJSONParentStations } from '../../helpers/geojson-parent-stations-fixture.ts';

import {
  Gtfs,
  importGtfs,
  type GtfsImportOptions,
} from '../../../src/index.ts';

export async function verifyGeoJSONIntegration(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-geojson-'));
  const gtfs = new Gtfs({
    database,
    extensions: ['gtfs-plus'],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    const sources = [];
    for (const [index, sourceId] of ['alpha', 'beta'].entries()) {
      const feedDirectory = path.join(directory, sourceId);
      await mkdir(feedDirectory);
      const x = index * 10;
      const files = {
        'agency.txt':
          'agency_id,agency_name,agency_url,agency_timezone\na,Transit,https://example.com,Etc/UTC\nb,Transit,https://example.com,Etc/UTC\n',
        'routes.txt':
          'route_id,agency_id,route_short_name,route_type,route_color,route_text_color\nred,a,R,3,FF0000,FFFFFF\nblue,b,B,3,0000FF,FFFFFF\nno-shape,a,N,3,,\n',
        'stops.txt': `stop_id,stop_name,stop_lat,stop_lon,location_type\nstop,Stop,0,${x},0\nstation,Station,0,${x + 3},1\n`,
        'trips.txt':
          'route_id,service_id,trip_id,shape_id\nred,weekday,red-out,shared\nred,weekday,red-in,shared\nred,branch,red-branch,branch\nblue,weekday,blue-out,shared\nno-shape,weekday,no-shape,\n',
        'stop_times.txt':
          'trip_id,stop_sequence,stop_id,arrival_time,departure_time\nred-out,1,stop,08:00:00,08:00:00\nred-in,1,stop,09:00:00,09:00:00\nblue-out,1,stop,10:00:00,10:00:00\nred-branch,1,stop,11:00:00,11:00:00\n',
        'calendar_dates.txt':
          'service_id,date,exception_type\nweekday,20260910,1\nbranch,20260911,1\n',
        'shapes.txt': `shape_id,shape_pt_sequence,shape_pt_lon,shape_pt_lat\nshared,3,${x},0\nshared,1,${x},0\nshared,2,${x + 1},1\nbranch,1,${x + 1},1\nbranch,2,${x + 2},2\norphan,1,${x + 8},8\norphan,2,${x + 9},9\n`,
        'stop_attributes.txt': 'stop_id,stop_city\nstop,City\n',
        'route_attributes.txt':
          'route_id,category,subcategory,running_way\nred,1,101,1\n',
      };
      for (const [filename, contents] of Object.entries(files)) {
        await writeFile(path.join(feedDirectory, filename), contents);
      }
      sources.push({
        sourceId,
        schedule: {
          path: feedDirectory,
          import: { validation: { mode: 'permissive' as const } },
        },
      });
    }
    await importGtfs({
      database,
      sources,
      extensions: ['gtfs-plus'],
      reporting: { level: 'silent' },
    });

    const stops = await gtfs.geojson.stops();
    const shapes = await gtfs.geojson.shapes();
    const routes = await gtfs.geojson.routes();
    assert.equal(stops.features.length, 2);
    assert.equal(shapes.features.length, 6);
    assert.equal(routes.features.length, 4);
    for (const collection of [stops, shapes, routes]) {
      assert.equal(collection.type, 'FeatureCollection');
      for (const feature of collection.features) {
        assert.equal('_unknown_fields' in feature.properties, false);
        assert.equal('_node_gtfs_storage_key' in feature.properties, false);
      }
    }
    for (const [index, sourceId] of ['alpha', 'beta'].entries()) {
      const sourceStops = stops.features.filter(
        (feature) => feature.properties.source_id === sourceId,
      );
      assert.deepEqual(
        sourceStops.map((feature) => feature.properties.stop_id),
        ['stop'],
      );
      const served = sourceStops.find(
        (feature) => feature.properties.stop_id === 'stop',
      );
      assert.ok(served);
      assert.deepEqual(served.geometry.coordinates, [index * 10, 0]);
      assert.equal(served.properties.stop_city, 'City');
      assert.equal('agency_name' in served.properties, false);
      assert.deepEqual(
        served.properties.routes.map((row) => [
          row.source_id,
          row.route_id,
          row.route_color,
        ]),
        [
          [sourceId, 'blue', '#0000FF'],
          [sourceId, 'red', '#FF0000'],
        ],
      );
      assert.equal(
        sourceStops.some((feature) => feature.properties.stop_id === 'station'),
        false,
      );
      const shared = shapes.features.find(
        (feature) =>
          feature.properties.source_id === sourceId &&
          feature.properties.shape_id === 'shared',
      );
      assert.ok(shared);
      assert.equal(shared.geometry.type, 'LineString');
      assert.deepEqual(shared.geometry.coordinates, [
        [index * 10, 0],
        [index * 10 + 1, 1],
        [index * 10, 0],
      ]);
      assert.deepEqual(
        shared.properties.routes.map((row) => row.route_id),
        ['blue', 'red'],
      );
      assert.equal('agency_name' in shared.properties, false);
      assert.equal('route_id' in shared.properties, false);
      const red = routes.features.find(
        (feature) =>
          feature.properties.source_id === sourceId &&
          feature.properties.route_id === 'red',
      );
      assert.ok(red);
      assert.equal(red.geometry.type, 'MultiLineString');
      assert.equal(red.properties.category, 1);
      assert.equal(red.properties.agency_name, 'Transit');
      assert.deepEqual(red.geometry.coordinates, [
        [
          [index * 10 + 1, 1],
          [index * 10 + 2, 2],
        ],
        [
          [index * 10, 0],
          [index * 10 + 1, 1],
        ],
      ]);
      const pointFiltered = await gtfs.geojson.shapes({
        where: {
          source_id: sourceId,
          shape_id: 'shared',
          shape_pt_sequence: 2,
        },
      });
      assert.deepEqual(pointFiltered.features, [shared]);
      const filteredRoutes = await gtfs.geojson.routes({
        where: { source_id: sourceId },
        serviceDate: 20260910,
      });
      assert.deepEqual(
        filteredRoutes.features,
        routes.features.filter(
          (feature) => feature.properties.source_id === sourceId,
        ),
      );
      const filteredShapes = await gtfs.geojson.shapes({
        where: { source_id: sourceId },
        serviceDate: 20260910,
      });
      assert.deepEqual(filteredShapes.features, [shared]);
      const filteredStops = await gtfs.geojson.stops({
        where: { source_id: sourceId },
        serviceDate: 20260910,
        routeId: 'red',
      });
      assert.deepEqual(filteredStops.features, [served]);
    }

    // Blue serves the shared stop/shape, but only red's branch service is active.
    // Route and service must qualify the same trip, not independent related trips.
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      assert.deepEqual(
        (await gtfs.geojson[method]({ routeId: 'blue', serviceDate: 20260911 }))
          .features,
        [],
      );
      assert.deepEqual(
        (await gtfs.geojson[method]({ routeId: "red' OR 1=1 --" })).features,
        [],
      );
    }
    const complete = await gtfs.geojson.shapes({
      where: { source_id: 'alpha', shape_id: 'shared' },
    });
    assert.deepEqual(
      await gtfs.geojson.shapes({
        routeId: 'red',
        serviceDate: 20260910,
        where: { source_id: 'alpha' },
        sqlWhere: (eb) => eb('shapes.shape_pt_sequence', '=', 2),
      }),
      complete,
    );
    assert.deepEqual(
      complete.features[0]!.properties.routes.map((route) => route.route_id),
      ['blue', 'red'],
    );
    assert.equal(
      (await gtfs.geojson.shapes({ where: { shape_id: 'orphan' } })).features
        .length,
      2,
    );
    assert.equal(
      (
        await gtfs.geojson.shapes({
          where: { shape_id: 'orphan' },
          serviceDate: 20260910,
        })
      ).features.length,
      0,
    );
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`update calendar_dates set exception_type = 2 where source_id = 'beta' and service_id = 'weekday' and date = 20260910`.execute(
          db,
        );
      },
    });
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      const active = await gtfs.geojson[method]({
        routeId: 'red',
        serviceDate: 20260910,
      });
      assert.equal(active.features.length, 1);
      assert.equal(active.features[0]!.properties.source_id, 'alpha');
    }

    const scoped = new Gtfs({
      database,
      sources: [{ sourceId: 'alpha' }],
      extensions: ['gtfs-plus'],
    });
    try {
      for (const method of ['stops', 'shapes', 'routes'] as const) {
        const features = (await scoped.geojson[method]()).features;
        let callbacks = 0;
        const sqlFiltered = await scoped.geojson[method]({
          sqlWhere: () => {
            callbacks += 1;
            return sql<boolean>`${sql.ref(`${method}.source_id`)} = ${'beta'} or 1 = 1`;
          },
        });
        assert.deepEqual(sqlFiltered.features, features);
        assert.equal(callbacks, 1);
        assert.deepEqual(
          (
            await scoped.geojson[method]({
              where: { source_id: 'beta' },
              routeId: 'red',
              serviceDate: 20260910,
              sqlWhere: () => sql<boolean>`1 = 1 or 1 = 1`,
            })
          ).features,
          [],
        );

        assert.ok(features.length > 0);
        assert.ok(
          features.every((feature) => feature.properties.source_id === 'alpha'),
        );
        assert.deepEqual(
          (await scoped.geojson[method]({ where: { source_id: 'beta' } }))
            .features,
          [],
        );
      }
    } finally {
      await scoped.close();
    }

    await gtfs.schema.recreate();
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      assert.deepEqual(await gtfs.geojson[method](), {
        type: 'FeatureCollection',
        features: [],
      });
      await assert.rejects(
        gtfs.geojson[method]({ where: { bogus: true } } as never),
        { code: 'GTFS_QUERY_INVALID' },
      );
    }
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`drop table trips`.execute(db);
      },
    });
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      await assert.rejects(gtfs.geojson[method](), {
        code: 'GTFS_SCHEMA_INVALID',
      });
    }
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`drop table stop_attributes`.execute(db);
        await sql`drop table route_attributes`.execute(db);
      },
    });
    const core = new Gtfs({ database });
    try {
      for (const method of ['stops', 'shapes', 'routes'] as const) {
        assert.deepEqual((await core.geojson[method]()).features, []);
        await assert.rejects(gtfs.geojson[method](), {
          code: 'GTFS_SCHEMA_INVALID',
        });
      }
    } finally {
      await core.close();
    }
  } finally {
    await gtfs.close();
    await rm(directory, { recursive: true, force: true });
  }
  await verifyGeoJSONBatchIntegration(database);
  await verifyGeoJSONParentStations(database);
}
