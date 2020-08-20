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

describe('gtfs.getTranslations():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no translations', async () => {
    const fieldName = 'fake-field-name';

    const results = await gtfs.getTranslations({
      field_name: fieldName
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
