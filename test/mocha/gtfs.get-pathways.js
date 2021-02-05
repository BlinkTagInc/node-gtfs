/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getPathways():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no pathways', async () => {
    const pathwayId = 'not_real';

    const results = await gtfs.getPathways({
      pathway_id: pathwayId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
