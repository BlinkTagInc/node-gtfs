import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTransfers } from '../../dist/index.js';

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
