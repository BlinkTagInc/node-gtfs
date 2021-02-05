/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getAttributions():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no attributions exist', async () => {
    const attributionId = 'fake-attribution-id';
    const results = await gtfs.getAttributions({
      attribution_id: attributionId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
