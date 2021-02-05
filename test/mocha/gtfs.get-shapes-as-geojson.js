/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getShapesAsGeoJSON():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return geojson with an empty features array if no shapes exist', async () => {
    const shapeId = 'fake-shape-id';
    const geojson = await gtfs.getShapesAsGeoJSON({
      shape_id: shapeId
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with shapes if they exist', async () => {
    const geojson = await gtfs.getShapesAsGeoJSON();

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific routeId', async () => {
    const routeId = 'Lo-16APR';

    const geojson = await gtfs.getShapesAsGeoJSON({
      route_id: routeId
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(2);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific routeId and directionId', async () => {
    const routeId = 'Lo-16APR';
    const directionId = 0;

    const geojson = await gtfs.getShapesAsGeoJSON({
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(2);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });
});
