import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getLocationGroupStops,
} from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getLocationGroupStops():', () => {
  it('should return empty array if no location group stops', () => {
    const locationGroupId = 'not_real';

    const results = getLocationGroupStops({
      location_group_id: locationGroupId,
    });

    expect(results).toHaveLength(0);
  });
});
