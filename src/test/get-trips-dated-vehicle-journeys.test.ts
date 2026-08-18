import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTripsDatedVehicleJourneys,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTripsDatedVehicleJourneys():', () => {
  it('should return empty array if no dated vehicle journeys (NOPTIS)', () => {
    const tripId = 'fake-trip-id';

    const results = getTripsDatedVehicleJourneys({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });
});
