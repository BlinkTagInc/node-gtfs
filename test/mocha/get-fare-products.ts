/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFareProducts } from '../../index.js';

describe('getFareProducts():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_products exist', () => {
    const fareProductId = 'fake-fare-product-id';
    const results = getFareProducts({
      fare_product_id: fareProductId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
