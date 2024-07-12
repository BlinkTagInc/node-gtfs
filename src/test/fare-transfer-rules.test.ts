import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareTransferRules } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareTransferRules():', () => {
  it('should return empty array if no fare_transfer_rules exist', () => {
    const transferId = 'fake-transfer-id';
    const results = getFareTransferRules({
      transfer_id: transferId,
    });

    expect(results).toHaveLength(0);
  });
});
