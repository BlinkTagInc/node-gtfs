import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getLocationGroups,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getLocationGroups():', () => {
  it('should return empty array if no location groups', () => {
    const locationGroupId = 'not_real';

    const results = getLocationGroups({
      location_group_id: locationGroupId,
    });

    expect(results).toHaveLength(0);
  });
});
