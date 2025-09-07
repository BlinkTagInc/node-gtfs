import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRiderCategories,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRiderCategories():', () => {
  it('should return empty array if no rider_categories exist', () => {
    const riderCategoryId = 'fake-rider-category-id';
    const results = getRiderCategories({
      rider_category_id: riderCategoryId,
    });

    expect(results).toHaveLength(0);
  });
});
