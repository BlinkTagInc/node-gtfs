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

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getDirectionsByRoute(): ', () => {
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

  it('should return empty array if no route', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const routeId = 'not_real';

      gtfs.getDirectionsByRoute(agencyKey, routeId, (err, directions) => {
        should.not.exists(err);
        should.exist(directions);
        directions.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected directions', done => {
    const routeId = 'Bu-16APR';

    gtfs.getDirectionsByRoute(agencyKey, routeId, (err, directions) => {
      should.not.exist(err);
      should.exist(directions);
      directions.should.have.length(3);

      const direction = directions[0];

      should.exist(direction.route_id);
      should.exist(direction.trip_headsign);
      should.exist(direction.direction_id);

      done();
    });
  });
});
