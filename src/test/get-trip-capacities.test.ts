import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTripCapacities,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
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
