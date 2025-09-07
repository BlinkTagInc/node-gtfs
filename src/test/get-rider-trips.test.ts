import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRiderTrips,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
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
