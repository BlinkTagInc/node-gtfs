import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
  createFeedFixture,
  type FeedFixture,
} from './test-utils.ts';
import { openDb, closeDb, importGtfs, getLocations } from '../../dist/index.js';

const locationsGeojson = JSON.stringify({
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

let fixture: FeedFixture;

describe('getLocations():', () => {
  beforeAll(async () => {
    // The base feed has no locations.geojson, so it is layered on top.
    fixture = await createFeedFixture({
      extraFiles: { 'locations.geojson': locationsGeojson },
    });

    openDb();
    await importGtfs({
      agencies: [{ path: fixture.path }],
      logLevel: 'silent',
    });
  });

  afterAll(async () => {
    closeDb(openDb());
    await fixture.cleanup();
  });

  it('should return a single location', () => {
    const results = getLocations({});

    expect(results).toHaveLength(1);
  });
});
