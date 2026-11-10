import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Gtfs, importGtfs, type GtfsImportOptions } from '../../src/index.ts';

export async function verifyGeoJSONBatchIntegration(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-geojson-batches-'));
  const gtfs = new Gtfs({
    database,
    extensions: ['gtfs-plus'],
    reporting: { level: 'silent' },
  });
  // More identities than SQLite's historical parameter limit, in each of two sources.
  const ids = Array.from({ length: 1001 }, (_, index) =>
    String(index).padStart(4, '0'),
  );
  const sources = [];
  try {
    for (const [sourceIndex, sourceId] of ['alpha', 'beta'].entries()) {
      const feedDirectory = path.join(directory, sourceId);
      await mkdir(feedDirectory);
      const x = sourceIndex * 10;
      const files = {
        'agency.txt': `agency_id,agency_name,agency_url,agency_timezone\na,${sourceId} Transit,https://example.com,Etc/UTC\n`,
        'calendar_dates.txt':
          'service_id,date,exception_type\nservice,20260910,1\n',
        'stops.txt':
          'stop_id,stop_name,stop_lat,stop_lon\n' +
          ids.map((id) => `${id},Stop ${id},0,${x}\n`).join(''),
        'routes.txt':
          'route_id,agency_id,route_short_name,route_type,route_color\n' +
          ids.map((id) => `${id},a,${id},3,FF0000\n`).join(''),
        'trips.txt':
          'trip_id,route_id,service_id,shape_id\n' +
          ids.map((id) => `${id},${id},service,${id}\n`).join('') +
          'shared,1000,service,0000\n' +
          `cross-source,${sourceIndex === 0 ? '0000' : '1000'},service,\n`,
        'stop_times.txt':
          'trip_id,stop_id,stop_sequence,arrival_time,departure_time\n' +
          ids
            .map(
              (id) =>
                `${id},${id},1,08:00:00,08:00:00\n${id},${id},2,09:00:00,09:00:00\n`,
            )
            .join('') +
          'shared,0000,1,10:00:00,10:00:00\n' +
          'cross-source,0500,1,10:00:00,10:00:00\n',
        'shapes.txt':
          'shape_id,shape_pt_sequence,shape_pt_lon,shape_pt_lat\n' +
          ids
            .map(
              (id, index) =>
                `${id},2,${x + 1},${index / 100}\n${id},1,${x},${index / 100}\n`,
            )
            .join(''),
        'stop_attributes.txt':
          'stop_id,stop_city\n' +
          ids.map((id) => `${id},${sourceId} City\n`).join(''),
        'route_attributes.txt':
          'route_id,category,subcategory,running_way\n' +
          ids
            .map((id) => `${id},1,${sourceIndex === 0 ? 101 : 102},1\n`)
            .join(''),
      };
      for (const [filename, contents] of Object.entries(files)) {
        await writeFile(path.join(feedDirectory, filename), contents);
      }
      sources.push({ sourceId, schedule: { path: feedDirectory } });
    }
    await importGtfs({
      database,
      sources,
      extensions: ['gtfs-plus'],
      reporting: { level: 'silent' },
    });
    const stops = await gtfs.geojson.stops();
    const shapes = await gtfs.geojson.shapes({
      where: { shape_pt_sequence: 2 },
    });
    const routes = await gtfs.geojson.routes();
    const expectedKeys = sources.flatMap(({ sourceId }) =>
      ids.map((id) => [sourceId, id]),
    );
    assert.deepEqual(
      stops.features.map(({ properties: row }) => [row.source_id, row.stop_id]),
      expectedKeys,
    );
    assert.deepEqual(
      shapes.features.map(({ properties: row }) => [
        row.source_id,
        row.shape_id,
      ]),
      expectedKeys,
    );
    assert.deepEqual(
      routes.features.map(({ properties: row }) => [
        row.source_id,
        row.route_id,
      ]),
      expectedKeys,
    );
    for (const feature of stops.features) {
      const { source_id: sourceId, stop_id: id } = feature.properties;
      assert.equal(feature.properties.stop_city, `${sourceId} City`);
      assert.deepEqual(feature.geometry.coordinates, [
        sourceId === 'alpha' ? 0 : 10,
        0,
      ]);
      assert.deepEqual(
        feature.properties.routes.map((route) => route.route_id),
        id === '0000'
          ? ['0000', '1000']
          : id === '0500'
            ? ['0500', sourceId === 'alpha' ? '0000' : '1000'].sort()
            : [id],
      );
    }
    for (const feature of shapes.features) {
      const { source_id: sourceId, shape_id: id } = feature.properties;
      const x = sourceId === 'alpha' ? 0 : 10;
      assert.deepEqual(feature.geometry.coordinates, [
        [x, Number(id) / 100],
        [x + 1, Number(id) / 100],
      ]);
      assert.deepEqual(
        feature.properties.routes.map((route) => route.route_id),
        id === '0000' ? ['0000', '1000'] : [id],
      );
    }
    for (const collection of [stops, shapes]) {
      for (const feature of collection.features) {
        for (const route of feature.properties.routes) {
          assert.equal(route.source_id, feature.properties.source_id);
          assert.equal(route.agency_name, `${route.source_id} Transit`);
          assert.equal(
            route.subcategory,
            route.source_id === 'alpha' ? 101 : 102,
          );
          assert.equal(route.route_color, '#FF0000');
        }
      }
    }
    for (const feature of routes.features) {
      const { source_id: sourceId, route_id: id } = feature.properties;
      const x = sourceId === 'alpha' ? 0 : 10;
      const ownShape = [
        [x, Number(id) / 100],
        [x + 1, Number(id) / 100],
      ];
      assert.deepEqual(
        feature.geometry.coordinates,
        id === '1000'
          ? [
              [
                [x, 0],
                [x + 1, 0],
              ],
              ownShape,
            ]
          : [ownShape],
      );
      assert.equal(feature.properties.agency_name, `${sourceId} Transit`);
      assert.equal(
        feature.properties.subcategory,
        sourceId === 'alpha' ? 101 : 102,
      );
    }
  } finally {
    await gtfs.close();
    await rm(directory, { recursive: true, force: true });
  }
}
