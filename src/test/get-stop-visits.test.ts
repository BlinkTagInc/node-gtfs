import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getStopVisits,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStopVisits():', () => {
  it('should return empty array if no stop visits (TIDES)', () => {
    const tripIdPerformed = 'fake-trip-id';

    const results = getStopVisits({
      trip_id_performed: tripIdPerformed,
    });

    expect(results).toHaveLength(0);
  });
});
