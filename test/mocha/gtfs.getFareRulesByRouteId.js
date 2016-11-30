const async = require('async');
const path = require('path');
const should = require('should');

// libraries
const config = require('../config.json');
const gtfs = require('../../');


// test support
const database = require('../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareRulesByRouteId(): ', () => {

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
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return empty array if no fare_rules', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
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
    const routeId = 'Bu-16APR';

    gtfs.getFareRulesByRouteId(agency_key, routeId, (err, fareRules) => {
      should.not.exist(err);
      should.exist(fareRules);
      fareRules.length.should.equal(36);

      const fareRule = fareRules[0].toObject();

      fareRule.agency_key.should.equal(agenciesFixtures[0].agency_key);
      should.exist(fareRule.fare_id);
      fareRule.route_id.should.equal(routeId);
      should.exist(fareRule.origin_id);
      should.exist(fareRule.destination_id);

      done();
    });
  });
});
