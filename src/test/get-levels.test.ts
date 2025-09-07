import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getLevels } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getLevels():', () => {
  it('should return empty array if no levels', () => {
    const levelId = 'not_real';

    const results = getLevels({
      level_id: levelId,
    });

    expect(results).toHaveLength(0);
  });
});
