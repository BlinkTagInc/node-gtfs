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

describe('gtfs.getRoutesById(): ', () => {

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

  it('should return empty array if no route', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      const routeId = 'not_real';

      gtfs.getRoutesById(agency_key, routeId, (err, route) => {
        should.not.exists(err);
        should.not.exists(route);
        done();
      });
    });
  });

  it('should return expected route', (done) => {
    const routeId = 'TaSj-16APR';

    gtfs.getRoutesById(agency_key, routeId, (err, route) => {
      should.not.exist(err);
      should.exist(route);

      route.agency_key.should.equal(agency_key);
      route.route_id.should.equal('TaSj-16APR');
      route.route_short_name.should.equal(' ');
      route.route_long_name.should.equal('Tamien / San Jose Diridon Caltrain Shuttle');
      route.route_type.should.equal(3);
      route.route_color.should.equal('41AD49');

      done();
    });
  });
});
