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

describe('gtfs.getRoutesById(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no route', () => {
    return database.teardown()
    .then(() => {
      const routeId = 'not_real';

      return gtfs.getRoutesById(agencyKey, routeId);
    })
    .then(route => {
      should.not.exists(route);
    });
  });

  it('should return expected route', () => {
    const routeId = 'TaSj-16APR';

    return gtfs.getRoutesById(agencyKey, routeId)
    .then(route => {
      should.exist(route);

      route.agency_key.should.equal(agencyKey);
      route.route_id.should.equal('TaSj-16APR');
      route.route_short_name.should.equal('');
      route.route_long_name.should.equal('Tamien / San Jose Diridon Caltrain Shuttle');
      route.route_type.should.equal(3);
      route.route_color.should.equal('41AD49');
    });
  });
});
