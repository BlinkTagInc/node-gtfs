/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFrequencies():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl);
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no frequencies', async () => {
    await mongoose.connection.db.dropDatabase();

    const tripId = 'not_real';

    const frequencies = await gtfs.getFrequencies({
      agency_key: agencyKey,
      trip_id: tripId
    });

    should.exists(frequencies);
    frequencies.should.have.length(0);

    await gtfs.import(config);
  });
});
