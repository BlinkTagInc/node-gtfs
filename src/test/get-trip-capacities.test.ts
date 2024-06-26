import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTripCapacities } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getTripCapacities():', () => {
  it('should return empty array if no trip capacities (GTFS-ride)', () => {
    const tripId = 'fake-trip-id';

    const results = getTripCapacities({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });
});
