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

describe('gtfs.getStopsAsGeoJSON(): ', () => {
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

  it('should return geojson with an empty features array if no stops exist for given agency', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'non_existing_agency';
      gtfs.getStopsAsGeoJSON(agencyKey, (err, geojson) => {
        should.not.exist(err);
        should.exist(geojson);
        geojson.type.should.equal('FeatureCollection');
        geojson.features.should.have.length(0);
        done();
      });
    });
  });

  it('should return geojson with stops if they exist for given agency', done => {
    const agencyKey = 'caltrain';

    gtfs.getStopsAsGeoJSON(agencyKey, (err, geojson) => {
      should.not.exist(err);
      should.exist(geojson);
      geojson.type.should.equal('FeatureCollection');
      geojson.features.should.have.length(95);
      done();
    });
  });

  it('should return geojson with stops if they exist for given agency and stopIds', done => {
    const agencyKey = 'caltrain';
    const stopIds = [
      '70031',
      '70061'
    ];

    gtfs.getStopsAsGeoJSON(agencyKey, stopIds, (err, geojson) => {
      should.not.exist(err);
      should.exist(geojson);
      geojson.type.should.equal('FeatureCollection');
      geojson.features.should.have.length(2);
      done();
    });
  });
});
