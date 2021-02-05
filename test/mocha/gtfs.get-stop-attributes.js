/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getStopAttributes():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no stop attributes', async () => {
    const stopId = 'fake-stop-id';

    const results = await gtfs.getStopAttributes({
      stop_id: stopId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
