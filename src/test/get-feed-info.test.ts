import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFeedInfo } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFeedInfo():', () => {
  it('should return empty array if no feed info', () => {
    const feedPublisherName = 'not_real';

    const results = getFeedInfo({
      feed_publisher_name: feedPublisherName,
    });

    expect(results).toHaveLength(0);
  });
});
