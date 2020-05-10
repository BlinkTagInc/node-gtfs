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

describe('gtfs.getFareAttributes():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no fare_attributes', async () => {
    await mongoose.connection.db.dropDatabase();
    const fareId = 'not_real';

    const fareAttributes = await gtfs.getFareAttributes({
      agency_key: agencyKey,
      fare_id: fareId
    });
    should.exists(fareAttributes);
    fareAttributes.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected fare_attributes', async () => {
    const fareId = 'OW_1_20160228';

    const fareAttributes = await gtfs.getFareAttributes({
      agency_key: agencyKey,
      fare_id: fareId
    });

    should.exist(fareAttributes);
    fareAttributes.length.should.equal(1);

    const fareAttribute = fareAttributes[0];

    const expectedFareAttribute = {
      fare_id: 'OW_1_20160228',
      price: 3.75,
      currency_type: 'USD',
      payment_method: 1,
      transfers: 0,
      transfer_duration: '',
      agency_key: 'caltrain'
    };

    delete fareAttribute._id;
    expectedFareAttribute.should.match(fareAttribute);
  });
});
