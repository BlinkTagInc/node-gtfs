import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFrequencies } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
