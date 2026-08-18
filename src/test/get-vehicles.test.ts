import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getVehicles } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getVehicles():', () => {
  it('should return empty array if no vehicles (TIDES)', () => {
    const vehicleId = 'fake-vehicle-id';

    const results = getVehicles({
      vehicle_id: vehicleId,
    });

    expect(results).toHaveLength(0);
  });
});
