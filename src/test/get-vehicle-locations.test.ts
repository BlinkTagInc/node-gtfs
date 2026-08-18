import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getVehicleLocations,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getVehicleLocations():', () => {
  it('should return empty array if no vehicle locations (TIDES)', () => {
    const locationPingId = 'fake-location-ping-id';

    const results = getVehicleLocations({
      location_ping_id: locationPingId,
    });

    expect(results).toHaveLength(0);
  });
});
