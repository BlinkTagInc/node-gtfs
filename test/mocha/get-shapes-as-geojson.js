/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getShapesAsGeoJSON,
} from '../../index.js';

describe('getShapesAsGeoJSON():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return geojson with an empty features array if no shapes exist', async () => {
    const shapeId = 'fake-shape-id';
    const geojson = await getShapesAsGeoJSON({
      shape_id: shapeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with shapes if they exist', async () => {
    const geojson = await getShapesAsGeoJSON();

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific routeId', async () => {
    const routeId = 'Lo-16APR';

    const geojson = await getShapesAsGeoJSON({
      route_id: routeId,
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

    const geojson = await getShapesAsGeoJSON({
      route_id: routeId,
      direction_id: directionId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(2);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific shapeId', async () => {
    const shapeId = 'cal_sf_tam';

    const geojson = await getShapesAsGeoJSON({
      shape_id: shapeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(3);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });
});
