import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getFareTransactions,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareTransactions():', () => {
  it('should return empty array if no fare transactions (TIDES)', () => {
    const transactionId = 'fake-transaction-id';

    const results = getFareTransactions({
      transaction_id: transactionId,
    });

    expect(results).toHaveLength(0);
  });
});
