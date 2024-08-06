import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRideFeedInfo } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRideFeedInfo():', () => {
  it('should return empty array if no ride-feed-infos (GTFS-ride)', () => {
    const results = getRideFeedInfo({});

    expect(results).toHaveLength(0);
  });
});
