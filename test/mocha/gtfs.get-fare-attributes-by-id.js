const path = require('path');

const async = require('async');
const should = require('should');

// libraries
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
  before(done => {
    database.connect(config, done);
  });

  after(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      closeDb: next => {
        database.close(next);
      }
    }, done);
  });

  beforeEach(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      executeDownloadScript: next => {
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return empty array if no fare_attributes', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const fareId = 'not_real';

      gtfs.getFareAttributesById(agencyKey, fareId, (err, fareAttributes) => {
        should.not.exists(err);
        should.not.exists(fareAttributes);
        done();
      });
    });
  });

  it('should return expected fare_attributes', done => {
    const fareId = 'OW_1_20160228';

    gtfs.getFareAttributesById(agencyKey, fareId, (err, fareAttribute) => {
      should.not.exist(err);
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

      done();
    });
  });
});
