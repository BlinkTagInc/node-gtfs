/* eslint-env mocha */

const path = require('path');
const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const gtfs = require('../..');

const config = {
  agencies: [{
    agency_key: 'caltrain',
    path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
  }],
  verbose: false
};

describe('gtfs.getFareAttributes():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no fare_attributes', async () => {
    const fareId = 'not_real';

    const results = await gtfs.getFareAttributes({
      fare_id: fareId
    });

    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected fare_attributes', async () => {
    const fareId = 'OW_1_20160228';

    const results = await gtfs.getFareAttributes({
      fare_id: fareId
    });

    const expectedResult = {
      fare_id: 'OW_1_20160228',
      price: 3.75,
      currency_type: 'USD',
      payment_method: 1,
      transfers: 0,
      agency_id: null,
      transfer_duration: null
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });
});
