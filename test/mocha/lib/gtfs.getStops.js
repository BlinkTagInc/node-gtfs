
const async = require('async');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database')(config);
let db;

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStops(): ', () => {

  before((done) => {
    async.series({
      connectToDb: (next) => {
        databaseTestSupport.connect((err, _db) => {
          db = _db;
          next();
        });
      }
    }, done);
  });

  after((done) => {
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

  it('should return an empty array if no stops exists for given agency', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    },() => {
      const agency_key = 'non_existing_agency';
      gtfs.getStops(agency_key, (err, stops) => {
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops if it exists for given agency', (done) => {
    const agency_key = 'caltrain';

    const expectedStopIds = [
      'Morgan Hill Caltrain',
      'Mountain View Caltrain',
      'Palo Alto Caltrain',
      'Redwood City Caltrain',
      'San Antonio Caltrain',
      'San Bruno Caltrain',
      'San Carlos Caltrain',
      'San Francisco Caltrain',
      'San Jose Caltrain',
      'San Martin Caltrain',
      'San Mateo Caltrain',
      'Santa Clara Caltrain',
      'So. San Francisco Caltrain',
      'Sunnyvale Caltrain',
      'Tamien Caltrain',
      '22nd Street Caltrain',
      'Atherton Caltrain',
      'Bayshore Caltrain',
      'Belmont Caltrain',
      'Blossom Hill Caltrain',
      'Burlingame Caltrain',
      'Broadway Caltrain',
      'California Ave Caltrain',
      'Capitol Caltrain',
      'College Park Caltrain',
      'Gilroy Caltrain',
      'Hayward Park Caltrain',
      'Hillsdale Caltrain',
      'Lawrence Caltrain',
      'Menlo Park Caltrain',
      'Millbrae Caltrain'
    ];

    gtfs.getStops(agency_key, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(31);
      done();
    });
  });

  it('should return array of stops if it exists for given agency, and stop_ids', (done) => {
    const agency_key = 'caltrain';
    const stop_ids = [
      'Burlingame Caltrain',
      '22nd Street Caltrain'
    ];

    gtfs.getStops(agency_key, stop_ids, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(2);
      done();
    });
  });
});
