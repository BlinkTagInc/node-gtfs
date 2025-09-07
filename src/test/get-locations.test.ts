import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import path from 'node:path';
import { rm, writeFile } from 'node:fs/promises';

import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getLocations,
  unzip,
  prepDirectory,
} from '../../dist/index.js';
import { temporaryDirectory } from 'tempy';

const temporaryDir = temporaryDirectory();

const locationsConfig = {
  agencies: [
    {
      path: temporaryDir,
    },
  ],
  verbose: false,
};

describe('getLocations():', () => {
  beforeAll(async () => {
    openDb();

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

  afterAll(() => {
    const db = openDb();
    closeDb(db);

    // Delete temporary directory
    rm(temporaryDir, { recursive: true, force: true });
  });

  it('should return a single location', () => {
    const results = getLocations({});

    expect(results).toHaveLength(1);
  });
});
