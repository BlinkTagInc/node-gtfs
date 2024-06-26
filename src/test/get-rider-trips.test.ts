import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRiderTrips } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getRiderTrips():', () => {
  it('should return empty array if no rider trips (GTFS-ride)', () => {
    const tripId = 'fake-trip-id';

    const results = getRiderTrips({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });
});
