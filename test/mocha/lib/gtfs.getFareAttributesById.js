
const async = require('async');
const should = require('should');
const tk = require('timekeeper');
const timeReference = new Date();

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database')(config);
let db;

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareAttributesById(): ', () => {

  before((done) => {
    async.series({
      connectToDb: (next) => {
        databaseTestSupport.connect((err, _db) => {
          db = _db;
          next();
        });
      },
      setupMockDate: (next) => {
        tk.freeze(timeReference);
        next();
      }
    }, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
      },
      resetMockDate: (next) => {
        tk.reset();
        next();
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return empty array if no fare_attributes', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
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

      fareAttribute.agency_key.should.equal(agency_key);
      fareAttribute.fare_id.should.equal('OW_2_20120701');
      fareAttribute.price.should.equal(5.0000);
      fareAttribute.currency_type.should.equal('USD');
      fareAttribute.payment_method.should.equal(1);
      should.not.exist(fareAttribute.transfers);
      should.not.exist(fareAttribute.transfer_duration);

      done();
    });
  });
});
