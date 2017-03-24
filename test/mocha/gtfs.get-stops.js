const path = require('path');

const async = require('async');
const should = require('should');

// libraries
const config = require('../config.json');
const gtfs = require('../../');

// test support
const database = require('../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStops(): ', () => {
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
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return an empty array if no stops exist for given agency', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'non_existing_agency';
      gtfs.getStops(agencyKey, (err, stops) => {
        should.not.exist(err);
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops for given agency', done => {
    const agencyKey = 'caltrain';

    gtfs.getStops(agencyKey, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(95);
      done();
    });
  });

  it('should return array of stops for given agency, and stopIds', done => {
    const agencyKey = 'caltrain';
    const stopIds = [
      '70031',
      '70061'
    ];

    gtfs.getStops(agencyKey, stopIds, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(2);
      done();
    });
  });
});
