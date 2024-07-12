import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRideFeedInfos } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRideFeedInfos():', () => {
  it('should return empty array if no ride-feed-infos (GTFS-ride)', () => {
    const results = getRideFeedInfos({});

    expect(results).toHaveLength(0);
  });
});
