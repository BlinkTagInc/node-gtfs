import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareTransferRules } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
