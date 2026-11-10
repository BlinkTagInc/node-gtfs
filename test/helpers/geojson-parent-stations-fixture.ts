import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Gtfs, importGtfs, type GtfsImportOptions } from '../../src/index.ts';

export async function verifyGeoJSONParentStations(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-parent-stations-'));
  const gtfs = new Gtfs({
    database,
    extensions: ['gtfs-plus'],
    reporting: { level: 'silent' },
  });
  try {
    const sources = [];
    for (const [index, sourceId] of ['alpha', 'beta'].entries()) {
      const feed = path.join(directory, sourceId);
      await mkdir(feed);
      const x = index * 20;
      const secondRoute = index === 0 ? 'blue' : 'green';
      const files = {
        'agency.txt': `agency_id,agency_name,agency_url,agency_timezone\na,${sourceId} Transit,https://example.com,Etc/UTC\n`,
        'calendar_dates.txt':
          'service_id,date,exception_type\ndaily,20260914,1\n',
        'stops.txt': [
          'stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_code,platform_code,wheelchair_boarding',
          `station,Same name,0,${x},1,,STATION,,1`,
          `a,Platform A,1,${x + 1},0,station,A,A,2`,
          `b,Platform B,2,${x + 2},,station,B,B,2`,
          'no-coordinates,No coordinates,,,0,station,,,',
          `entrance,Entrance,3,${x + 3},2,station,,,`,
          `node,Node,4,${x + 4},3,station,,,`,
          `boarding,Boarding area,5,${x + 5},4,a,,,`,
          `standalone,Standalone,6,${x + 6},,,,,`,
          `unparented-area,Unparented area,7,${x + 7},4,standalone,,,`,
          `wrong-area,Wrong area,8,${x + 8},4,station,,,`,
          `missing,Missing parent,9,${x + 9},0,absent,,,`,
          'bad-station,Bad coordinates,,,1,,,,',
          `fallback,Fallback,10,${x + 10},0,bad-station,,,`,
          `wrong-parent,Wrong parent type,11,${x + 11},0,standalone,,,`,
          `cycle-a,Cycle A,12,${x + 12},0,cycle-b,,,`,
          `cycle-b,Cycle B,13,${x + 13},0,cycle-a,,,`,
          `self,Self,14,${x + 14},0,self,,,`,
          `other-station,Same name,0,${x + 0.001},1,,,,`,
          `other-child,Other child,15,${x + 15},0,other-station,,,`,
          `foreign-child,Foreign parent,16,${x + 16},0,foreign-station,,,`,
          ...(index === 0
            ? [`foreign-station,Only alpha,17,${x + 17},1,,,,`]
            : []),
          '',
        ].join('\n'),
        'routes.txt': `route_id,agency_id,route_short_name,route_type,route_color\nred,a,R,3,FF0000\n${secondRoute},a,Other,3,00FF00\n`,
        'trips.txt': `trip_id,route_id,service_id\na,red,daily\nb,${secondRoute},daily\nagain,red,daily\n`,
        'stop_times.txt':
          'trip_id,stop_sequence,stop_id,arrival_time,departure_time\na,1,a,08:00:00,08:00:00\nb,1,b,08:00:00,08:00:00\nagain,1,b,09:00:00,09:00:00\n',
        'stop_attributes.txt': `stop_id,stop_city\nstation,${sourceId} Parent City\na,Child City\n`,
        'route_attributes.txt':
          'route_id,category,subcategory,running_way\nred,1,101,1\n',
      };
      for (const [filename, contents] of Object.entries(files)) {
        await writeFile(path.join(feed, filename), contents);
      }
      sources.push({
        sourceId,
        schedule: {
          path: feed,
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

    assert.deepEqual(
      await gtfs.geojson.stops({ useParentStation: false }),
      await gtfs.geojson.stops(),
    );
    const ungrouped = await gtfs.geojson.stops();
    assert.ok(
      ungrouped.features.every(
        (feature) => feature.properties.location_type !== 1,
      ),
    );
    for (const sourceId of ['alpha', 'beta']) {
      for (const stopId of ['a', 'b', 'standalone', 'missing', 'fallback']) {
        assert.ok(
          ungrouped.features.some(
            (feature) =>
              feature.properties.source_id === sourceId &&
              feature.properties.stop_id === stopId,
          ),
        );
      }
    }
    assert.deepEqual(
      (await gtfs.geojson.stops({ where: { stop_id: 'station' } })).features,
      [],
    );
    const grouped = await gtfs.geojson.stops({ useParentStation: true });
    assert.ok(
      grouped.features.every((feature) => !feature.properties.parent_station),
    );
    assert.equal(
      grouped.features.filter(
        (feature) => feature.properties.stop_id === 'standalone',
      ).length,
      2,
    );
    assert.equal(
      grouped.features.filter(
        (feature) => feature.properties.stop_name === 'Same name',
      ).length,
      4,
      'Same names and nearby coordinates must not merge different station IDs',
    );
    for (const [index, sourceId] of ['alpha', 'beta'].entries()) {
      const expectedRoutes = ['red', index === 0 ? 'blue' : 'green'].sort();
      const parent = grouped.features.find(
        (feature) =>
          feature.properties.source_id === sourceId &&
          feature.properties.stop_id === 'station',
      );
      assert.ok(parent);
      assert.deepEqual(parent.geometry.coordinates, [index * 20, 0]);
      assert.equal(parent.properties.stop_name, 'Same name');
      assert.equal(parent.properties.stop_code, 'STATION');
      assert.equal(parent.properties.wheelchair_boarding, 1);
      assert.equal('platform_code' in parent.properties, false);
      assert.equal(parent.properties.stop_city, `${sourceId} Parent City`);
      assert.equal(parent.properties.agency_name, `${sourceId} Transit`);
      assert.deepEqual(
        parent.properties.routes.map((route) => route.route_id),
        expectedRoutes,
      );
      for (const route of parent.properties.routes) {
        assert.equal(route.source_id, sourceId);
        assert.equal(route.agency_name, `${sourceId} Transit`);
        if (route.route_id === 'red') {
          assert.equal(route.route_color, '#FF0000');
          assert.equal(route.category, 1);
        }
      }
      for (const stopId of [
        'a',
        'b',
        'entrance',
        'node',
        'boarding',
        'no-coordinates',
        'station',
      ]) {
        assert.deepEqual(
          (
            await gtfs.geojson.stops({
              useParentStation: true,
              where: { source_id: sourceId, stop_id: stopId },
            })
          ).features,
          [parent],
          `Parent resolution and complete route metadata for ${stopId}`,
        );
      }
      const routeFiltered = await gtfs.geojson.stops({
        useParentStation: true,
        where: { source_id: sourceId },
        routeId: 'red',
      });
      assert.deepEqual(routeFiltered.features, [parent]);
      const boundsFiltered = await gtfs.geojson.stops({
        useParentStation: true,
        where: {
          withinBounds: {
            south: 0.9,
            north: 1.1,
            west: index * 20 + 0.9,
            east: index * 20 + 1.1,
          },
        },
      });
      assert.deepEqual(
        boundsFiltered.features,
        [parent],
        'The selected platform may be in bounds while its emitted parent is outside',
      );
      for (const stopId of [
        'unparented-area',
        'wrong-area',
        'missing',
        'fallback',
        'wrong-parent',
        'cycle-a',
        'cycle-b',
        'self',
      ]) {
        const where = { source_id: sourceId, stop_id: stopId };
        assert.deepEqual(
          await gtfs.geojson.stops({ where, useParentStation: true }),
          { type: 'FeatureCollection', features: [] },
          `Omit child ${stopId} when there is no usable station`,
        );
      }
      assert.deepEqual(
        (
          await gtfs.geojson.stops({
            useParentStation: true,
            where: { source_id: sourceId, stop_id: 'bad-station' },
          })
        ).features,
        [],
      );
    }
    const scoped = new Gtfs({
      database,
      sources: [{ sourceId: 'beta' }],
      extensions: ['gtfs-plus'],
    });
    try {
      const result = await scoped.geojson.stops({
        where: { stop_id: 'foreign-child' },
        useParentStation: true,
      });
      assert.deepEqual(
        result.features,
        [],
        'A child must not use a parent from another source',
      );
      assert.deepEqual(
        (
          await scoped.geojson.stops({
            where: { source_id: 'alpha' },
            useParentStation: true,
          })
        ).features,
        [],
      );
    } finally {
      await scoped.close();
    }
    await gtfs.schema.recreate();
    assert.deepEqual(
      (await gtfs.geojson.stops({ useParentStation: true })).features,
      [],
    );
  } finally {
    await gtfs.close();
    await rm(directory, { recursive: true, force: true });
  }
}
