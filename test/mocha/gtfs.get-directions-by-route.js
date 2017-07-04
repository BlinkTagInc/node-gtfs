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

describe('gtfs.getDirectionsByRoute(): ', () => {
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

      return gtfs.getDirectionsByRoute(agencyKey, routeId);
    })
    .then(directions => {
      should.exist(directions);
      directions.should.have.length(0);
    });
  });

  it('should return expected directions', () => {
    const routeId = 'Bu-16APR';

    return gtfs.getDirectionsByRoute(agencyKey, routeId)
    .then(directions => {
      should.exist(directions);
      directions.should.have.length(3);

      const direction = directions[0];

      should.exist(direction.route_id);
      should.exist(direction.trip_headsign);
      should.exist(direction.direction_id);
    });
  });
});
