/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getFrequencies():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no frequencies', async () => {
    const tripId = 'not_real';

    const results = await gtfs.getFrequencies({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
