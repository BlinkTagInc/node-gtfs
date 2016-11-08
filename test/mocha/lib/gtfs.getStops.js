const async = require('async');
const path = require('path');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const database = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '/../../fixture/caltrain_20120824_0333.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStops(): ', () => {

  before((done) => {
    database.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      closeDb: (next) => {
        database.close(next);
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return an empty array if no stops exists for given agency', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
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
