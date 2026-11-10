import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  Gtfs,
  importGtfs,
  type GtfsImportOptions,
} from '../../../src/index.ts';

export async function verifyImportResultCounts(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-import-results-'));
  try {
    await writeFile(
      path.join(directory, 'stops.txt'),
      [
        'stop_id,stop_name,stop_lat',
        'first,First,0',
        'first,Duplicate,0',
        'invalid,Invalid,not-a-number',
        'last,Last,1',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(directory, 'stop_times.txt'),
      [
        'trip_id,stop_sequence,stop_id',
        'trip,01,first',
        'trip,1,last',
        'trip,2,last',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(directory, 'shapes.txt'),
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n',
    );
    await writeFile(path.join(directory, 'frequencies.txt'), '');
    await writeFile(
      path.join(directory, 'feed_info.txt'),
      'feed_publisher_name\nExcluded\n',
    );
    await writeFile(
      path.join(directory, 'directions.txt'),
      'route_id,direction_id,direction\nroute,0,Disabled\n',
    );
    await writeFile(
      path.join(directory, 'locations.geojson'),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'location',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      }),
    );
    const result = await importGtfs({
      database,
      sources: [
        {
          sourceId: 'result-counts',
          schedule: {
            path: directory,
            excludeFiles: ['feed_info.txt'],
            import: {
              validation: { mode: 'permissive', onDuplicateKey: 'keep-first' },
            },
          },
        },
      ],
      reporting: { level: 'silent' },
    });
    assert.equal(result.success, true);
    assert.equal(result.sources.length, 1);
    assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0);
    const source = result.sources[0];
    assert.ok(source);
    assert.equal(source.sourceId, 'result-counts');
    assert.equal(source.success, true);
    assert.equal(source.error, undefined);
    assert.ok(source.durationMs >= 0 && source.durationMs <= result.durationMs);
    assert.deepEqual(
      Object.fromEntries(
        source.files.map(({ filename, ...counts }) => [filename, counts]),
      ),
      {
        'stops.txt': { recordsRead: 4, rowsInserted: 2, rowsSkipped: 2 },
        'stop_times.txt': { recordsRead: 3, rowsInserted: 2, rowsSkipped: 1 },
        'shapes.txt': { recordsRead: 0, rowsInserted: 0, rowsSkipped: 0 },
        'frequencies.txt': { recordsRead: 0, rowsInserted: 0, rowsSkipped: 0 },
        'locations.geojson': {
          recordsRead: 1,
          rowsInserted: 1,
          rowsSkipped: 0,
        },
      },
    );
    const gtfs = new Gtfs({
      database,
      sources: [{ sourceId: 'result-counts' }],
    });
    try {
      assert.equal((await gtfs.schedule.stops.all()).length, 2);
      assert.equal((await gtfs.schedule.stopTimes.all()).length, 2);
      assert.equal((await gtfs.schedule.locations.all()).length, 1);
      assert.equal(
        (await gtfs.schedule.stops.where({ stop_id: 'first' }).first())
          ?.stop_name,
        'First',
      );
    } finally {
      await gtfs.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
