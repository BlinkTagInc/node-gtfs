import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getPathways } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getPathways():', () => {
  it('should return empty array if no pathways', () => {
    const pathwayId = 'not_real';

    const results = getPathways({
      pathway_id: pathwayId,
    });

    expect(results).toHaveLength(0);
  });
});
