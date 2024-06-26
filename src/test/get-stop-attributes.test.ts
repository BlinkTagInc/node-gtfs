import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getStopAttributes } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getStopAttributes():', () => {
  it('should return empty array if no stop attributes', () => {
    const stopId = 'fake-stop-id';

    const results = getStopAttributes({
      stop_id: stopId,
    });

    expect(results).toHaveLength(0);
  });
});
