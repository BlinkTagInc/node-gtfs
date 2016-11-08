const async = require('async');
const path = require('path');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const database = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '/../../fixture/caltrain_20120824_0333.zip')
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareAttributesById(): ', () => {

  before((done) => {
    database.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      closeDb: (next) => {
        database.close(next);
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return empty array if no fare_attributes', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      const fareId = 'not_real';

      gtfs.getFareAttributesById(agency_key, fareId, (err, fareAttributes) => {
        should.not.exists(err);
        should.not.exists(fareAttributes);
        done();
      });
    });
  });

  it('should return expected fare_attributes', (done) => {
    const fareId = 'OW_2_20120701';

    gtfs.getFareAttributesById(agency_key, fareId, (err, fareAttribute) => {
      should.not.exist(err);
      should.exist(fareAttribute);

      const expectedFareAttribute = {
        fare_id: 'OW_2_20120701',
        price: 5.0000,
        currency_type: 'USD',
        payment_method: 1,
        transfers: null,
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
