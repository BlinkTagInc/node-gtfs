/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getRiderTrips():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no rider trips (GTFS-ride)', async () => {
    const tripId = 'fake-trip-id';

    const results = await gtfs.getRiderTrips({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
