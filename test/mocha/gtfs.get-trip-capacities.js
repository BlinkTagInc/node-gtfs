/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getTripCapacities():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no trip capacities (GTFS-ride)', async () => {
    const tripId = 'fake-trip-id';

    const results = await gtfs.getTripCapacities({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
