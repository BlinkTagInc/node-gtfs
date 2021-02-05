/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getFeedInfo():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no feed info', async () => {
    const feedPublisherName = 'not_real';

    const results = await gtfs.getFeedInfo({
      feed_publisher_name: feedPublisherName
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
