import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getShapesAsGeoJSON,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getShapesAsGeoJSON():', () => {
  it('should return geojson with an empty features array if no shapes exist', () => {
    const shapeId = 'fake-shape-id';
    const geojson = getShapesAsGeoJSON({
      shape_id: shapeId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(0);
  });

  it('should return geojson with shapes if they exist', () => {
    const geojson = getShapesAsGeoJSON();

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(4);
    const exampleFeature = geojson.features.find(
      (feature) => feature?.properties?.route_id === 'Bu-16APR',
    );
    expect(
      (exampleFeature?.geometry as GeoJSON.MultiLineString).coordinates[0],
    ).toHaveLength(381);
    expect(
      (exampleFeature?.geometry as GeoJSON.MultiLineString).coordinates[0][0],
    ).toHaveLength(2);
    expect(exampleFeature?.properties?.route_color).toMatch(/^#/);
  });

  it('should return geojson with shapes for a specific routeId', () => {
    const routeId = 'Lo-16APR';

    const geojson = getShapesAsGeoJSON({
      route_id: routeId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString).coordinates[0],
    ).toHaveLength(556);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString)
        .coordinates[0][0],
    ).toHaveLength(2);
    expect(geojson.features[0].properties?.route_color).toMatch(/^#/);
  });

  it('should return geojson with shapes for a specific routeId and directionId', () => {
    const routeId = 'Lo-16APR';
    const directionId = 0;

    const geojson = getShapesAsGeoJSON({
      route_id: routeId,
      direction_id: directionId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString).coordinates[0],
    ).toHaveLength(382);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString)
        .coordinates[0][0],
    ).toHaveLength(2);
    expect(geojson.features[0].properties?.route_color).toMatch(/^#/);
  });

  it('should return geojson with shapes for a specific shapeId', () => {
    const shapeId = 'cal_sf_tam';

    const geojson = getShapesAsGeoJSON({
      shape_id: shapeId,
    });

    expect(geojson.type).toEqual('FeatureCollection');
    expect(geojson.features).toHaveLength(3);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString).coordinates[0],
    ).toHaveLength(401);
    expect(
      (geojson.features[0].geometry as GeoJSON.MultiLineString)
        .coordinates[0][0],
    ).toHaveLength(2);
    expect(geojson.features[0].properties?.route_color).toMatch(/^#/);
  });
});
