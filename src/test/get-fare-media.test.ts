import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareMedia } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareMedia():', () => {
  it('should return empty array if no fare_media exist', () => {
    const fareMediaId = 'fake-fare-media-id';
    const results = getFareMedia({
      fare_media_id: fareMediaId,
    });

    expect(results).toHaveLength(0);
  });
});
