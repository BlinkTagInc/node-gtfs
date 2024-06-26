import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getFareProducts } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
