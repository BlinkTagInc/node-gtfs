import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getVehicleTrainCars,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getVehicleTrainCars():', () => {
  it('should return empty array if no vehicle train cars (TIDES)', () => {
    const vehicleId = 'fake-vehicle-id';

    const results = getVehicleTrainCars({
      vehicle_id: vehicleId,
    });

    expect(results).toHaveLength(0);
  });
});
