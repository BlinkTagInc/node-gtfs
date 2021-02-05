/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getDirections():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no directions', async () => {
    const fareRouteId = 'not_real';

    const results = await gtfs.getDirections({
      route_id: fareRouteId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
