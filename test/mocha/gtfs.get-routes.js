/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutes():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no routes for given agency exist', async () => {
    await mongoose.connection.db.dropDatabase();
    const routes = await gtfs.getRoutes({
      agency_key: agencyKey
    });
    should.exist(routes);
    routes.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected routes for given agency', async () => {
    const routes = await gtfs.getRoutes({
      agency_key: agencyKey
    });

    should.exist(routes);

    const expectedRoutes = {
      'Bu-16APR': {
        route_id: 'Bu-16APR',
        route_short_name: '',
        route_long_name: 'Baby Bullet',
        route_type: 2,
        route_color: 'E31837',
        agency_key: 'caltrain'
      },
      'Li-16APR': {
        route_id: 'Li-16APR',
        route_short_name: '',
        route_long_name: 'Limited',
        route_type: 2,
        route_color: 'FEF0B5',
        agency_key: 'caltrain'
      },
      'Lo-16APR': {
        route_id: 'Lo-16APR',
        route_short_name: '',
        route_long_name: 'Local',
        route_type: 2,
        route_color: 'FFFFFF',
        agency_key: 'caltrain'
      },
      'TaSj-16APR': {
        route_id: 'TaSj-16APR',
        route_short_name: '',
        route_long_name: 'Tamien / San Jose Diridon Caltrain Shuttle',
        route_type: 3,
        route_color: '41AD49',
        agency_key: 'caltrain'
      }
    };

    routes.should.have.length(4);

    routes.forEach(route => {
      const expectedRoute = expectedRoutes[route.route_id];

      should.exist(expectedRoute);
      expectedRoute.should.match(route);
    });
  });

  it('should return an empty array if no routes within given distance exist', async () => {
    const lon = -130.9867495;
    const lat = 45.38976166855;
    const radius = 2;

    const routes = await gtfs.getRoutes({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(routes);
    routes.should.have.length(0);
  });

  it('should return expected routes within given distance if they exist', async () => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 2;
    const expectedRoutes = {
      'Li-16APR': {
        route_id: 'Li-16APR',
        route_short_name: '',
        route_long_name: 'Limited',
        route_type: 2,
        route_color: 'FEF0B5',
        agency_key: 'caltrain'
      },
      'Lo-16APR': {
        route_id: 'Lo-16APR',
        route_short_name: '',
        route_long_name: 'Local',
        route_type: 2,
        route_color: 'FFFFFF',
        agency_key: 'caltrain'
      }
    };

    const routes = await gtfs.getRoutes({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(routes);
    routes.should.have.length(2);

    routes.forEach(route => {
      const expectedRoute = expectedRoutes[route.route_id];

      should.exist(expectedRoute);
      expectedRoute.should.match(route);
    });
  });

  it('should return expected routes within given distance (without specifying radius)', async () => {
    const lon = -122.39797353744507;
    const lat = 37.7210684234136;
    const expectedRoutes = {
      'Li-16APR': {
        route_id: 'Li-16APR',
        route_short_name: '',
        route_long_name: 'Limited',
        route_type: 2,
        route_color: 'FEF0B5',
        agency_key: 'caltrain'
      },
      'Lo-16APR': {
        route_id: 'Lo-16APR',
        route_short_name: '',
        route_long_name: 'Local',
        route_type: 2,
        route_color: 'FFFFFF',
        agency_key: 'caltrain'
      }
    };

    const routes = await gtfs.getRoutes({
      within: {
        lat,
        lon
      }
    });

    should.exist(routes);
    routes.should.have.length(2);

    routes.forEach(route => {
      const expectedRoute = expectedRoutes[route.route_id];

      should.exist(expectedRoute);
      expectedRoute.should.match(route);
    });
  });

  it('should return expected route with a specified route_id', async () => {
    const routeId = 'TaSj-16APR';

    const routes = await gtfs.getRoutes({ route_id: routeId });

    should.exist(routes);
    routes.should.have.length(1);

    const route = routes[0];

    const expectedRoute = {
      route_id: 'TaSj-16APR',
      route_short_name: '',
      route_long_name: 'Tamien / San Jose Diridon Caltrain Shuttle',
      route_type: 3,
      route_color: '41AD49',
      agency_key: 'caltrain'
    };

    expectedRoute.should.match(route);
  });
});
