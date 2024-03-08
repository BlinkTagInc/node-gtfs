/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFareAttributes } from '../../index.js';

describe('getFareAttributes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_attributes', () => {
    const fareId = 'not_real';

    const results = getFareAttributes({
      fare_id: fareId,
    });

    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected fare_attributes', () => {
    const fareId = 'OW_1_20160228';

    const results = getFareAttributes({
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
