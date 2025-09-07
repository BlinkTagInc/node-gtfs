import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getFrequencies,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFrequencies():', () => {
  it('should return empty array if no frequencies', () => {
    const tripId = 'not_real';

    const results = getFrequencies({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });
});
