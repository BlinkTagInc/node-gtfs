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
const agencyId = agenciesFixtures[0].agency_id;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByAgency(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no routes for given agency exist (agencyId not provided)', () => {
    return database.teardown()
    .then(() => gtfs.getRoutesByAgency(agencyKey))
    .then(routes => {
      should.exist(routes);
      routes.should.have.length(0);
    });
  });

  it('should return expected routes for given agency (agencyId not provided)', () => {
    return gtfs.getRoutesByAgency(agencyKey)
    .then(routes => {
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
  });

  it('should return empty array if no routes for given agency exist (agencyId provided)', () => {
    return database.teardown()
    .then(() => gtfs.getRoutesByAgency(agencyKey, agencyId))
    .then(routes => {
      should.exist(routes);
      routes.should.have.length(0);
    });
  });

  it('should return expected routes for given agency and agencyId', () => {
    return gtfs.getRoutesByAgency(agencyKey, agencyId)
    .then(routes => {
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
  });
});
