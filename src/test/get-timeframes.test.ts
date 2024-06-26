import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTimeframes } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getTimeframes():', () => {
  it('should return empty array if no timeframes', () => {
    const timeframeGroupId = 'not_real';

    const results = getTimeframes({
      timeframe_group_id: timeframeGroupId,
    });

    expect(results).toHaveLength(0);
  });
});
