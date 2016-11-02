const async = require('async');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByRoute(): ', () => {

  before((done) => {
    databaseTestSupport.connect(config, done);
  });

  after(function(done) {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return an empty array if no stops exists for given agency, route and direction', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    }, () => {
      const agency_key = 'non_existing_agency';
      const route_id = 'non_existing_route_id';
      const direction_id = '0';
      gtfs.getStopsByRoute(agency_key, route_id, direction_id, (err, stops) => {
        should.not.exist(err);
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops if it exists for given agency, route and direction', (done) => {
    const agency_key = 'caltrain';
    const route_id = 'ct_local_20120701';
    const direction_id = '0';

    const expectedStopIds = [
      'San Jose Caltrain',
      'Santa Clara Caltrain',
      'Lawrence Caltrain',
      'Sunnyvale Caltrain',
      'Mountain View Caltrain',
      'San Antonio Caltrain',
      'California Ave Caltrain',
      'Palo Alto Caltrain',
      'Menlo Park Caltrain',
      'Atherton Caltrain',
      'Redwood City Caltrain',
      'San Carlos Caltrain',
      'Belmont Caltrain',
      'Hillsdale Caltrain',
      'Hayward Park Caltrain',
      'San Mateo Caltrain',
      'Burlingame Caltrain',
      'Broadway Caltrain',
      'Millbrae Caltrain',
      'San Bruno Caltrain',
      'So. San Francisco Caltrain',
      'Bayshore Caltrain',
      '22nd Street Caltrain',
      'San Francisco Caltrain'
    ];

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(24);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });

      done();
    });
  });

  it('should return array of stops if it exists for given agency, route and direction (opposite direction)', (done) => {
    const agency_key = 'caltrain';
    const route_id = 'ct_local_20120701';
    const direction_id = '1';

    const expectedStopIds = [
      'San Francisco Caltrain',
      '22nd Street Caltrain',
      'Bayshore Caltrain',
      'So. San Francisco Caltrain',
      'San Bruno Caltrain',
      'Millbrae Caltrain',
      'Burlingame Caltrain',
      'San Mateo Caltrain',
      'Hayward Park Caltrain',
      'Hillsdale Caltrain',
      'Belmont Caltrain',
      'San Carlos Caltrain',
      'Redwood City Caltrain',
      'Menlo Park Caltrain',
      'Palo Alto Caltrain',
      'California Ave Caltrain',
      'San Antonio Caltrain',
      'Mountain View Caltrain',
      'Sunnyvale Caltrain',
      'Lawrence Caltrain',
      'Santa Clara Caltrain',
      'College Park Caltrain',
      'San Jose Caltrain',
      'Tamien Caltrain',
      'Capitol Caltrain',
      'Blossom Hill Caltrain',
      'Morgan Hill Caltrain',
      'San Martin Caltrain',
      'Gilroy Caltrain'
    ];

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(29);

      stops.forEach((stop, idx) => {
        expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      });

      done();
    });
  });

  it('should return array of all stops for all directions if it exists for given agency and route (without specifying direction)', (done) => {
    const agency_key = 'caltrain';
    const route_id = 'ct_local_20120701';

    const expectedResults = [
      {
        direction_id: 0,
        stops_count: 24,
        stops: [
          'San Jose Caltrain',
          'Santa Clara Caltrain',
          'Lawrence Caltrain',
          'Sunnyvale Caltrain',
          'Mountain View Caltrain',
          'San Antonio Caltrain',
          'California Ave Caltrain',
          'Palo Alto Caltrain',
          'Menlo Park Caltrain',
          'Atherton Caltrain',
          'Redwood City Caltrain',
          'San Carlos Caltrain',
          'Belmont Caltrain',
          'Hillsdale Caltrain',
          'Hayward Park Caltrain',
          'San Mateo Caltrain',
          'Burlingame Caltrain',
          'Broadway Caltrain',
          'Millbrae Caltrain',
          'San Bruno Caltrain',
          'So. San Francisco Caltrain',
          'Bayshore Caltrain',
          '22nd Street Caltrain',
          'San Francisco Caltrain'
        ]
      },
      {
        direction_id: 1,
        stops_count: 29,
        stops: [
          'San Francisco Caltrain',
          '22nd Street Caltrain',
          'Bayshore Caltrain',
          'So. San Francisco Caltrain',
          'San Bruno Caltrain',
          'Millbrae Caltrain',
          'Burlingame Caltrain',
          'San Mateo Caltrain',
          'Hayward Park Caltrain',
          'Hillsdale Caltrain',
          'Belmont Caltrain',
          'San Carlos Caltrain',
          'Redwood City Caltrain',
          'Menlo Park Caltrain',
          'Palo Alto Caltrain',
          'California Ave Caltrain',
          'San Antonio Caltrain',
          'Mountain View Caltrain',
          'Sunnyvale Caltrain',
          'Lawrence Caltrain',
          'Santa Clara Caltrain',
          'College Park Caltrain',
          'San Jose Caltrain',
          'Tamien Caltrain',
          'Capitol Caltrain',
          'Blossom Hill Caltrain',
          'Morgan Hill Caltrain',
          'San Martin Caltrain',
          'Gilroy Caltrain'
        ]
      }
    ];

    gtfs.getStopsByRoute(agency_key, route_id, (err, results) => {
      should.not.exist(err);
      should.exist(results);

      results.should.have.length(2, 'Should have 2 directions');
      results.forEach((row) => {
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
