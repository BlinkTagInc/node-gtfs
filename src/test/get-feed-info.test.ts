import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFeedInfo } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
