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

describe('gtfs.getFareAttributesById(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no fare_attributes', () => {
    return database.teardown()
    .then(() => {
      const fareId = 'not_real';

      return gtfs.getFareAttributesById(agencyKey, fareId);
    })
    .then(fareAttributes => {
      should.not.exists(fareAttributes);
    });
  });

  it('should return expected fare_attributes', () => {
    const fareId = 'OW_1_20160228';

    return gtfs.getFareAttributesById(agencyKey, fareId)
    .then(fareAttribute => {
      should.exist(fareAttribute);

      const expectedFareAttribute = {
        fare_id: 'OW_1_20160228',
        price: 3.75,
        currency_type: 'USD',
        payment_method: 1,
        transfers: 0,
        transfer_duration: null,
        agency_key: 'caltrain'
      };

      const fareAttributeFormatted = fareAttribute.toObject();
      delete fareAttributeFormatted._id;
      expectedFareAttribute.should.match(fareAttributeFormatted);
    });
  });
});
