import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRideFeedInfo,
} from '../../dist/index.js';

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
