import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimeframes,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
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
