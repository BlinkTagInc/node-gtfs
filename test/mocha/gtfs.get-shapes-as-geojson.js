const path = require('path');

const should = require('should');

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
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return geojson with an empty features array if no shapes exist for given agency', () => {
    return database.teardown()
    .then(() => {
      const agencyKey = 'non_existing_agency';
      return gtfs.getShapesAsGeoJSON(agencyKey)
    })
    .then(geojson => {
      should.exist(geojson);
      geojson.type.should.equal('FeatureCollection');
      geojson.features.should.have.length(0);
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
