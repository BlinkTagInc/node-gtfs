const path = require('path');

const async = require('async');
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

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByDistance(): ', () => {
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

  it('should return an empty array if no routes exist', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const lon = -121.9867495;
      const lat = 37.38976166855;
      const radius = 100;

      gtfs.getRoutesByDistance(lat, lon, radius, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return an empty array if no routes within given distance exist', done => {
    const lon = -127.9867495;
    const lat = 40.38976166855;
    const radius = 100;

    gtfs.getRoutesByDistance(lat, lon, radius, (err, res) => {
      should.not.exist(err);
      should.exist(res);
      res.should.have.length(0);
      done();
    });
  });


  it('should return expected routes within given distance if they exist', done => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 2;
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

    gtfs.getRoutesByDistance(lat, lon, radius, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(2);

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

  it('should return expected routes within given distance (without specifying radius) if exists', done => {
    const lon = -122.39797353744507;
    const lat = 37.7210684234136;
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

    gtfs.getRoutesByDistance(lat, lon, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(2);

      routes.forEach(route => {
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
