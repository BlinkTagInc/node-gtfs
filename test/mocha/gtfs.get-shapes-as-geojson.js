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

describe('gtfs.getShapesAsGeoJSON(): ', () => {
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

  it('should return geojson with an empty features array if no shapes exist for given agency', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'non_existing_agency';
      gtfs.getShapesAsGeoJSON(agencyKey, (err, geojson) => {
        should.not.exist(err);
        should.exist(geojson);
        geojson.type.should.equal('FeatureCollection');
        geojson.features.should.have.length(0);
        done();
      });
    });
  });

  it('should return geojson with shapes if they exist for given agency', () => {
    const agencyKey = 'caltrain';

    return gtfs.getShapesAsGeoJSON(agencyKey)
    .then(geojson => {
      should.exist(geojson);
      geojson.type.should.equal('FeatureCollection');
      geojson.features.length.should.be.above(1);
    });
  });

  it('should return geojson with shapes if they exist for given agency and routeId', () => {
    const agencyKey = 'caltrain';
    const routeId = 'Lo-16APR';

    return gtfs.getShapesByRouteAsGeoJSON(agencyKey, routeId)
    .then(geojson => {
      should.exist(geojson);
      geojson.type.should.equal('FeatureCollection');
      geojson.features.length.should.be.above(1);
    });
  });
});
