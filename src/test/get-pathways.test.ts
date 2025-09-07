import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getPathways } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
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
