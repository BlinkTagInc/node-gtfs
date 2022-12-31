/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getShapesAsGeoJSON,
} from '../../index.js';

describe('getShapesAsGeoJSON():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return geojson with an empty features array if no shapes exist', () => {
    const shapeId = 'fake-shape-id';
    const geojson = getShapesAsGeoJSON({
      shape_id: shapeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with shapes if they exist', () => {
    const geojson = getShapesAsGeoJSON();

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific routeId', () => {
    const routeId = 'Lo-16APR';

    const geojson = getShapesAsGeoJSON({
      route_id: routeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(2);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates[0].length.should.equal(2);
    geojson.features[0].properties.route_color.should.startWith('#');
  });

  it('should return geojson with shapes for a specific routeId and directionId', () => {
    const routeId = 'Lo-16APR';
    const directionId = 0;

    const geojson = getShapesAsGeoJSON({
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

  it('should return geojson with shapes for a specific shapeId', () => {
    const shapeId = 'cal_sf_tam';

    const geojson = getShapesAsGeoJSON({
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
