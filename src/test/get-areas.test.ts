import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getAreas } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getAreas():', () => {
  it('should return empty array if no areas exist', () => {
    const areaId = 'fake-area-id';
    const results = getAreas({
      area_id: areaId,
    });

    expect(results).toHaveLength(0);
  });
});
