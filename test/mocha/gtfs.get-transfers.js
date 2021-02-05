/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

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
