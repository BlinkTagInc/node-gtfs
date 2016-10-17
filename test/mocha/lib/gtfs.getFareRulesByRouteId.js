
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

describe('gtfs.getFareRulesByRouteId(): ', () => {

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

  it('should return empty array if no fare_rules', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    }, () => {
      const routeId = 'not_real';

      gtfs.getFareRulesByRouteId(agency_key, routeId, (err, fareRules) => {
        should.not.exists(err);
        should.exists(fareRules);
        fareRules.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected fare_rules', (done) => {
    const routeId = 'ct_bullet_20120701';

    gtfs.getFareRulesByRouteId(agency_key, routeId, (err, fareRules) => {
      should.not.exist(err);
      should.exist(fareRules);
      fareRules.length.should.equal(108);

      const fareRule = fareRules[0].toObject();

      const expectedFareRule = {
        fare_id: 'OW_1_20120701',
        route_id: 'ct_bullet_20120701',
        origin_id: '1',
        destination_id: '1',
        contains_id: '',
        agency_key: 'caltrain'
      };

      fareRule.agency_key.should.equal(expectedFareRule.agency_key);
      fareRule.fare_id.should.equal(expectedFareRule.fare_id);
      fareRule.route_id.should.equal(expectedFareRule.route_id);
      fareRule.origin_id.should.equal(expectedFareRule.origin_id);
      fareRule.destination_id.should.equal(expectedFareRule.destination_id);
      fareRule.contains_id.should.equal(expectedFareRule.contains_id);

      done();
    });
  });
});
