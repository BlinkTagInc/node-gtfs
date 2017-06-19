const path = require('path');

const async = require('async');
const should = require('should');

// libraries
const config = require('../config.json');
const gtfs = require('../../');


const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByStopCode(): ', () => {
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

  it('should return an empty array if no stops exist for given agency', done => {
    async.series({
      teardownDatabase: next => {
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

  it('should return array of stops for given agency', done => {
    const agency_key = 'caltrain';

    gtfs.getStopsByStopCode(agency_key, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(95);
      done();
    });
  });

  it('should return array of stops for given agency, and stop_ids', done => {
    const agency_key = 'caltrain';
    const stop_codes = [
      '70031',
      '70061'
    ];

    gtfs.getStopsByStopCode(agency_key, stop_codes, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(2);
      done();
    });
  });
});
