import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTransfers } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTransfers():', () => {
  it('should return empty array if no transfers', () => {
    const fromStopId = 'fake-stop-id';

    const results = getTransfers({
      from_stop_id: fromStopId,
    });

    expect(results).toHaveLength(0);
  });
});
