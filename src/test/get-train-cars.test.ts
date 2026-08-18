import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTrainCars } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTrainCars():', () => {
  it('should return empty array if no train cars (TIDES)', () => {
    const trainCarId = 'fake-train-car-id';

    const results = getTrainCars({
      train_car_id: trainCarId,
    });

    expect(results).toHaveLength(0);
  });
});
