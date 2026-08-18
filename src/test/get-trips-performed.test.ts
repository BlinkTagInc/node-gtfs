import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTripsPerformed,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTripsPerformed():', () => {
  it('should return empty array if no trips performed (TIDES)', () => {
    const tripIdPerformed = 'fake-trip-id';

    const results = getTripsPerformed({
      trip_id_performed: tripIdPerformed,
    });

    expect(results).toHaveLength(0);
  });
});
