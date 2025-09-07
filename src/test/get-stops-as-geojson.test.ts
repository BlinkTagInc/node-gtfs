import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getStopsAsGeoJSON,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStopsAsGeoJSON(): ', () => {
  it('should return geojson with an empty features array if no stops exist', () => {
    const stopId = 'fake-stop-id';
    const geojson = getStopsAsGeoJSON({
      stop_id: stopId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(0);
  });

  it('should return geojson with stops if they exist', () => {
    const geojson = getStopsAsGeoJSON();

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(64);
    expect(
      (geojson.features[0].geometry as GeoJSON.Point).coordinates,
    ).toHaveLength(2);
  });

  it('should return geojson with stops if they exist for a specific stopId', () => {
    const stopId = '70031';

    const geojson = getStopsAsGeoJSON({
      stop_id: stopId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(
      (geojson.features[0].geometry as GeoJSON.Point).coordinates,
    ).toHaveLength(2);
  });

  it('should return geojson with stops if they exist for a specific shapeId', () => {
    const shapeId = 'cal_sf_tam';

    const geojson = getStopsAsGeoJSON({
      shape_id: shapeId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(25);
    expect(
      (geojson.features[0].geometry as GeoJSON.Point).coordinates,
    ).toHaveLength(2);
  });

  it('should return geojson with specific stops for bounding box query', () => {
    const distance = 100;
    const stopLatitude = 37.709538;
    const stopLongitude = -122.401586;

    const geojson = getStopsAsGeoJSON(
      {
        stop_lat: stopLatitude,
        stop_lon: stopLongitude,
      },
      { bounding_box_side_m: distance },
    );

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(2);
    expect(
      (geojson.features[0].geometry as GeoJSON.Point).coordinates,
    ).toHaveLength(2);
  });
});
