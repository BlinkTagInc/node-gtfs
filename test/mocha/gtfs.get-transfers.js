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

describe('gtfs.getTransfers():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no transfers', async () => {
    const fromStopId = 'fake-stop-id';

    const results = await gtfs.getTransfers({
      from_stop_id: fromStopId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
