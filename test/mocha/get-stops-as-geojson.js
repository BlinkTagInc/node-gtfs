/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getStopsAsGeoJSON } from '../../index.js';

describe('getStopsAsGeoJSON(): ', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return geojson with an empty features array if no stops exist', () => {
    const stopId = 'fake-stop-id';
    const geojson = getStopsAsGeoJSON({
      stop_id: stopId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with stops if they exist', () => {
    const geojson = getStopsAsGeoJSON();

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });

  it('should return geojson with stops if they exist for a specific stopId', () => {
    const stopId = '70031';

    const geojson = getStopsAsGeoJSON({
      stop_id: stopId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });

  it('should return geojson with stops if they exist for a specific shapeId', () => {
    const shapeId = 'cal_sf_tam';

    const geojson = getStopsAsGeoJSON({
      shape_id: shapeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(25);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });
});
