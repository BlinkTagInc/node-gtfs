import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareMedia } from '../index.ts';

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
