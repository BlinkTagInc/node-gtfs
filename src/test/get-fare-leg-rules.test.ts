import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareLegRules } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareLegRules():', () => {
  it('should return empty array if no fare_leg_rules exist', () => {
    const legGroupId = 'fake-leg-group-id';
    const results = getFareLegRules({
      leg_group_id: legGroupId,
    });

    expect(results).toHaveLength(0);
  });
});
