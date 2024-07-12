import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getLevels } from '../index.ts';

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
