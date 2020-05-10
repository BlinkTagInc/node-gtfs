/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getShapesAsGeoJSON():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return geojson with an empty features array if no shapes exist for given agency', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencyKey = 'non_existing_agency';
    const geojson = await gtfs.getShapesAsGeoJSON({
      agency_key: agencyKey
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);

    await gtfs.import(config);
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
    geojson.features.length.should.be.above(0);
  });
});
