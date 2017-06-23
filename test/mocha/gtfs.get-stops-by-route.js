const path = require('path');

const async = require('async');
const should = require('should');

// Libraries
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
        gtfs.import(config)
        .then(next)
        .catch(next);
      }
    }, done);
  });

  it('should return an empty array if no stops exists for given agency, route and direction', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'non_existing_agency';
      const routeId = 'non_existing_route_id';
      const directionId = '0';
      gtfs.getStopsByRoute(agencyKey, routeId, directionId, (err, stops) => {
        should.not.exist(err);
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops if it exists for given agency, route and direction', done => {
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

    gtfs.getStopsByRoute(agencyKey, routeId, directionId, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(9);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });

      done();
    });
  });

  it('should return array of stops if it exists for given agency, route and direction (opposite direction)', done => {
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

    gtfs.getStopsByRoute(agencyKey, routeId, directionId, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(9);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });

      done();
    });
  });

  it('should return array of all stops for all directions if it exists for given agency and route (without specifying direction)', done => {
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

    gtfs.getStopsByRoute(agencyKey, routeId, (err, results) => {
      should.not.exist(err);
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

      done();
    });
  });
});
