import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getStopAreas } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStopAreas():', () => {
  it('should return empty array if no stop areas', () => {
    const areaId = 'fake-area-id';

    const results = getStopAreas({
      area_id: areaId,
    });

    expect(results).toHaveLength(0);
  });
});
