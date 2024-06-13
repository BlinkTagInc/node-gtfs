/* eslint-env mocha */

import should from 'should';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getLocations } from '../../index.js';
import { unzip, prepDirectory } from '../../lib/file-utils.js';

const temporaryDir = path.join(import.meta.dirname, '../fixture/tmp2/');

const locationsConfig = {
  agencies: [
    {
      path: temporaryDir,
    },
  ],
  verbose: false,
};

describe('getLocations():', () => {
  before(async () => {
    openDb(locationsConfig);

    // Add locations.geojson to test GTFS dataset
    await prepDirectory(temporaryDir);
    await unzip(config.agencies[0].path, temporaryDir);

    const filePath = path.join(temporaryDir, 'locations.geojson');
    const fileText = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          id: '1',
          type: 'Feature',
          properties: {
            stop_desc: 'This is a stop for testing',
            stop_name: 'Test Stop 1',
          },
          geometry: {
            type: 'Point',
            coordinates: [
              [
                [-94.7805702, 44.4560958],
                [-94.7805608, 44.4559928],
                [-94.7805218, 44.4559649],
              ],
            ],
          },
        },
      ],
    });
    await writeFile(filePath, fileText);

    await importGtfs(locationsConfig);
  });

  after(() => {
    const db = openDb(locationsConfig);
    closeDb(db);
  });

  it('should return a single location', () => {
    const results = getLocations({});
    should.exists(results);
    results.should.have.length(1);
  });
});
