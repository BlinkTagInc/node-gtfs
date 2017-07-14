const path = require('path');

const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareAttributesById():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return empty array if no fare_attributes', async () => {
    await database.teardown();
    const fareId = 'not_real';

    const fareAttributes = await gtfs.getFareAttributes({
      agency_key: agencyKey,
      fare_id: fareId
    });
    should.exists(fareAttributes);
    fareAttributes.should.have.length(0);
  });

  it('should return expected fare_attributes', async () => {
    const fareId = 'OW_1_20160228';

    const fareAttributes = await  gtfs.getFareAttributes({
      agency_key: agencyKey,
      fare_id: fareId
    });

    should.exist(fareAttributes);
    fareAttributes.length.should.equal(1);

    const fareAttribute = fareAttributes[0].toObject();

    const expectedFareAttribute = {
      fare_id: 'OW_1_20160228',
      price: 3.75,
      currency_type: 'USD',
      payment_method: 1,
      transfers: 0,
      transfer_duration: null,
      agency_key: 'caltrain'
    };

    delete fareAttribute._id;
    expectedFareAttribute.should.match(fareAttribute);
  });
});
