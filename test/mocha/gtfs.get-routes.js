const path = require('path');

const should = require('should');

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

describe('gtfs.getRoutes():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return empty array if no routes for given agency exist', async () => {
    await database.teardown();
    const routes = await gtfs.getRoutes({
      agency_key: agencyKey
    });
    should.exist(routes);
    routes.should.have.length(0);
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
      route.route_id.should.equal(expectedRoute.route_id);
      route.route_short_name.should.equal(expectedRoute.route_short_name);
      route.route_long_name.should.equal(expectedRoute.route_long_name);
      route.route_type.should.equal(expectedRoute.route_type);
      route.route_color.should.equal(expectedRoute.route_color);
      route.agency_key.should.equal(expectedRoute.agency_key);
    });
  });


  it('should return an empty array if no routes exist', async () => {
    await database.teardown();

    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 100;

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

    const routes = await gtfs.getRoutes({
      within: {
        lat,
        lon,
        radius
      }
    });

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
  });

  it('should return expected routes within given distance (without specifying radius)', async () => {
    const lon = -122.39797353744507;
    const lat = 37.7210684234136;
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
      route.route_id.should.equal(expectedRoute.route_id);
      route.route_short_name.should.equal(expectedRoute.route_short_name);
      route.route_long_name.should.equal(expectedRoute.route_long_name);
      route.route_type.should.equal(expectedRoute.route_type);
      route.route_color.should.equal(expectedRoute.route_color);
      route.agency_key.should.equal(expectedRoute.agency_key);
    });
  });

  it('should return expected route with a specified route_id', async () => {
    const routeId = 'TaSj-16APR';

    const routes = await gtfs.getRoutes({route_id: routeId});

    should.exist(routes);
    routes.should.have.length(1);

    const route = routes[0].toObject();

    route.agency_key.should.equal(agencyKey);
    route.route_id.should.equal('TaSj-16APR');
    route.route_short_name.should.equal('');
    route.route_long_name.should.equal('Tamien / San Jose Diridon Caltrain Shuttle');
    route.route_type.should.equal(3);
    route.route_color.should.equal('41AD49');
  });
});
