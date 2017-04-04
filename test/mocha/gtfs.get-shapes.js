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

describe('gtfs.getShapes(): ', () => {
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

  it('should return an empty array if no shapes exist for given agency', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'non_existing_agency';
      gtfs.getShapes(agencyKey, (err, shapes) => {
        should.not.exist(err);
        should.exist(shapes);
        shapes.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of shapes for given agency', done => {
    const agencyKey = 'caltrain';

    gtfs.getShapes(agencyKey, (err, shapes) => {
      should.not.exist(err);
      should.exist(shapes);

      shapes.should.have.length(8);
      done();
    });
  });
});
