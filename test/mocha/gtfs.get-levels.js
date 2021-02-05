/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getLevels():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no levels', async () => {
    const levelId = 'not_real';

    const results = await gtfs.getLevels({
      level_id: levelId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
