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
const agency_id = agenciesFixtures[0].agency_id;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByAgency(): ', () => {

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

  it('should return empty array if no routes for given agency exists (agency_id not provided)', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      gtfs.getRoutesByAgency(agency_key, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected routes for given agency (agency_id not provided)', (done) => {
    gtfs.getRoutesByAgency(agency_key, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);

      const expectedRoutes = {
        'Bu-16APR': {
          route_id: 'Bu-16APR',
          route_short_name: ' ',
          route_long_name: 'Baby Bullet',
          route_type: 2,
          route_color: 'E31837',
          agency_key: 'caltrain'
        },
        'Li-16APR': {
          route_id: 'Li-16APR',
          route_short_name: ' ',
          route_long_name: 'Limited',
          route_type: 2,
          route_color: 'FEF0B5',
          agency_key: 'caltrain'
        },
        'Lo-16APR': {
          route_id: 'Lo-16APR',
          route_short_name: ' ',
          route_long_name: 'Local',
          route_type: 2,
          route_color: 'FFFFFF',
          agency_key: 'caltrain'
        },
        'TaSj-16APR': {
          route_id: 'TaSj-16APR',
          route_short_name: ' ',
          route_long_name: 'Tamien / San Jose Diridon Caltrain Shuttle',
          route_type: 3,
          route_color: '41AD49',
          agency_key: 'caltrain'
        }
      };

      routes.should.have.length(4);

      routes.forEach((route) => {
        const expectedRoute = expectedRoutes[route.route_id];

        should.exist(expectedRoute);
        route.route_id.should.equal(expectedRoute.route_id);
        route.route_short_name.should.equal(expectedRoute.route_short_name);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_type.should.equal(expectedRoute.route_type);
        route.route_color.should.equal(expectedRoute.route_color);
        route.agency_key.should.equal(expectedRoute.agency_key);
      });

      done();
    });
  });

  it('should return empty array if no routes for given agency exists (agency_id provided)', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      gtfs.getRoutesByAgency(agency_key, agency_id, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected routes for given agency and agency_id', (done) => {
    gtfs.getRoutesByAgency(agency_key, agency_id, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);

      const expectedRoutes = {
        'Bu-16APR': {
          route_id: 'Bu-16APR',
          route_short_name: ' ',
          route_long_name: 'Baby Bullet',
          route_type: 2,
          route_color: 'E31837',
          agency_key: 'caltrain'
        },
        'Li-16APR': {
          route_id: 'Li-16APR',
          route_short_name: ' ',
          route_long_name: 'Limited',
          route_type: 2,
          route_color: 'FEF0B5',
          agency_key: 'caltrain'
        },
        'Lo-16APR': {
          route_id: 'Lo-16APR',
          route_short_name: ' ',
          route_long_name: 'Local',
          route_type: 2,
          route_color: 'FFFFFF',
          agency_key: 'caltrain'
        },
        'TaSj-16APR': {
          route_id: 'TaSj-16APR',
          route_short_name: ' ',
          route_long_name: 'Tamien / San Jose Diridon Caltrain Shuttle',
          route_type: 3,
          route_color: '41AD49',
          agency_key: 'caltrain'
        }
      };

      routes.should.have.length(4);

      routes.forEach((route) => {
        const expectedRoute = expectedRoutes[route.route_id];

        should.exist(expectedRoute);
        route.route_id.should.equal(expectedRoute.route_id);
        route.route_short_name.should.equal(expectedRoute.route_short_name);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_type.should.equal(expectedRoute.route_type);
        route.route_color.should.equal(expectedRoute.route_color);
        route.agency_key.should.equal(expectedRoute.agency_key);
      });

      done();
    });
  });
});
