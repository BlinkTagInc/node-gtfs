import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getFareProducts,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareProducts():', () => {
  it('should return empty array if no fare_products exist', () => {
    const fareProductId = 'fake-fare-product-id';
    const results = getFareProducts({
      fare_product_id: fareProductId,
    });

    expect(results).toHaveLength(0);
  });
});
