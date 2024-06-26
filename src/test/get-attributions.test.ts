import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getAttributions } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getAttributions():', () => {
  it('should return empty array if no attributions exist', () => {
    const attributionId = 'fake-attribution-id';
    const results = getAttributions({
      attribution_id: attributionId,
    });

    expect(results).toHaveLength(0);
  });
});
