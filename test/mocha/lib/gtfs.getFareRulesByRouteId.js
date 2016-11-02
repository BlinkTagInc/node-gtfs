const async = require('async');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareRulesByRouteId(): ', () => {

  before((done) => {
    databaseTestSupport.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
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

      fareRule.agency_key.should.equal(agenciesFixtures[0].agency_key);
      should.exist(fareRule.fare_id);
      fareRule.route_id.should.equal(routeId);
      should.exist(fareRule.origin_id);
      should.exist(fareRule.destination_id);
      should.exist(fareRule.contains_id);

      done();
    });
  });
});
