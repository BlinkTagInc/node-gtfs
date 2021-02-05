/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getTrips():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no trips exist', async () => {
    const tripId = 'fake-trip-id';

    const results = await gtfs.getTrips({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected trips', async () => {
    const routeId = 'Bu-16APR';

    const results = await gtfs.getTrips({
      route_id: routeId
    });

    const expectedResult = {
      trip_id: '329',
      route_id: 'Bu-16APR',
      service_id: 'CT-16APR-Caltrain-Weekday-01',
      trip_headsign: 'SAN FRANCISCO STATION',
      trip_short_name: '329',
      direction_id: 0,
      block_id: null,
      shape_id: 'cal_tam_sf',
      wheelchair_accessible: 1,
      bikes_allowed: 1
    };

    should.exists(results);
    results.length.should.equal(30);
    results.should.containEql(expectedResult);
  });
});
