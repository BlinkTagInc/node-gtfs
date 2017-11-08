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

describe('gtfs.getShapesAsGeoJSON():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return geojson with an empty features array if no shapes exist for given agency', async () => {
    await database.teardown();

    const agencyKey = 'non_existing_agency';
    const geojson = await gtfs.getShapesAsGeoJSON({
      agency_key: agencyKey
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with shapes if they exist for given agency', async () => {
    const agencyKey = 'caltrain';

    const geojson = await gtfs.getShapesAsGeoJSON({
      agency_key: agencyKey
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
  });

  it('should return geojson with shapes if they exist for given agency and routeId', async () => {
    const agencyKey = 'caltrain';
    const routeId = 'Lo-16APR';

    const geojson = await gtfs.getShapesAsGeoJSON({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
  });

  it('should return geojson with shapes if they exist for given agency and routeId and directionId', async () => {
    const agencyKey = 'caltrain';
    const routeId = 'Lo-16APR';
    const directionId = 0;

    const geojson = await gtfs.getShapesAsGeoJSON({
      agency_key: agencyKey,
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
  });
});
