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

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByRoute(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return an empty array if no stops exists for given agency, route and direction', () => {
    return database.teardown()
    .then(() => {
      const agencyKey = 'non_existing_agency';
      const routeId = 'non_existing_route_id';
      const directionId = '0';
      return gtfs.getStopsByRoute(agencyKey, routeId, directionId);
    })
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(0);
    });
  });

  it('should return array of stops if it exists for given agency, route and direction', () => {
    const agencyKey = 'caltrain';
    const routeId = 'Bu-16APR';
    const directionId = '0';

    const expectedStopIds = [
      '70261',
      '70221',
      '70211',
      '70171',
      '70141',
      '70111',
      '70091',
      '70061',
      '70011'
    ];

    return gtfs.getStopsByRoute(agencyKey, routeId, directionId)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(9);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });
    });
  });

  it('should return array of stops if it exists for given agency, route and direction (opposite direction)', () => {
    const agencyKey = 'caltrain';
    const routeId = 'Bu-16APR';
    const directionId = '1';

    const expectedStopIds = [
      '70012',
      '70062',
      '70092',
      '70112',
      '70142',
      '70172',
      '70212',
      '70222',
      '70262'
    ];

    return gtfs.getStopsByRoute(agencyKey, routeId, directionId)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(9);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });
    });
  });

  it('should return array of all stops for all directions if it exists for given agency and route (without specifying direction)', () => {
    const agencyKey = 'caltrain';
    const routeId = 'Bu-16APR';

    const expectedResults = [
      {
        direction_id: 0,
        stops_count: 9,
        stops: [
          '70261',
          '70221',
          '70211',
          '70171',
          '70141',
          '70111',
          '70091',
          '70061',
          '70011'
        ]
      },
      {
        direction_id: 1,
        stops_count: 9,
        stops: [
          '70012',
          '70062',
          '70092',
          '70112',
          '70142',
          '70172',
          '70212',
          '70222',
          '70262'
        ]
      }
    ];

    return gtfs.getStopsByRoute(agencyKey, routeId)
    .then(results => {
      should.exist(results);

      results.should.have.length(2, 'Should have 2 directions');
      results.forEach(row => {
        row.should.have.property('direction_id');
        row.should.have.property('stops');
        row.stops.should.have.length(expectedResults[row.direction_id].stops_count);
        row.stops.forEach((stop, idx) => {
          expectedResults[row.direction_id].stops[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
        });
      });
    });
  });
});
