/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getStopsAsGeoJSON,
} from '../../index.js';

describe('getStopsAsGeoJSON(): ', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return geojson with an empty features array if no stops exist', async () => {
    const stopId = 'fake-stop-id';
    const geojson = await getStopsAsGeoJSON({
      stop_id: stopId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with stops if they exist', async () => {
    const geojson = await getStopsAsGeoJSON();

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.be.above(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });

  it('should return geojson with stops if they exist for a specific stopId', async () => {
    const stopId = '70031';

    const geojson = await getStopsAsGeoJSON({
      stop_id: stopId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(1);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });

  it('should return geojson with stops if they exist for a specific shapeId', async () => {
    const shapeId = 'cal_sf_tam';

    const geojson = await getStopsAsGeoJSON({
      shape_id: shapeId,
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.length.should.equal(25);
    should.exist(geojson.features[0].geometry.coordinates);
    geojson.features[0].geometry.coordinates.length.should.equal(2);
  });
});
