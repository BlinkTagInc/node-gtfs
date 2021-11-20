/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getFareAttributes,
} from '../../index.js';

describe('getFareAttributes():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no fare_attributes', async () => {
    const fareId = 'not_real';

    const results = await getFareAttributes({
      fare_id: fareId,
    });

    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected fare_attributes', async () => {
    const fareId = 'OW_1_20160228';

    const results = await getFareAttributes({
      fare_id: fareId,
    });

    const expectedResult = {
      fare_id: 'OW_1_20160228',
      price: 3.75,
      currency_type: 'USD',
      payment_method: 1,
      transfers: 0,
      agency_id: null,
      transfer_duration: null,
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });
});
