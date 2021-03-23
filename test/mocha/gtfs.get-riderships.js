/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getRiderships():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no riderships (GTFS-ride)', async () => {
    const routeId = 'fake-route-id';

    const results = await gtfs.getRiderships({
      route_id: routeId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
