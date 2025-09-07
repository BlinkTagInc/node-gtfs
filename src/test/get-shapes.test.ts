import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getShapes } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getShapes():', () => {
  it('should return an empty array if no shapes exist', () => {
    const shapeId = 'fake-shape-id';

    const results = getShapes({
      shape_id: shapeId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return an empty array if no matching trips exist', () => {
    const routeId = 'TaSj-16APR';
    const serviceId = 'fake-service-id';

    const results = getShapes({
      route_id: routeId,
      service_id: serviceId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return array of shapes', () => {
    const results = getShapes({}, [
      'shape_id',
      'shape_pt_lat',
      'shape_pt_lon',
      'shape_pt_sequence',
      'shape_dist_traveled',
    ]);

    const expectedResult = {
      shape_id: 'cal_tam_sf',
      shape_pt_lat: 37.607_687_113_495_64,
      shape_pt_lon: -122.394_679_784_774_78,
      shape_pt_sequence: 244,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(3008);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of shapes by route', () => {
    const routeId = 'TaSj-16APR';
    const results = getShapes(
      {
        route_id: routeId,
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_tam_sj',
      shape_pt_lat: 37.323558,
      shape_pt_lon: -121.8919,
      shape_pt_sequence: 10051,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(331);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of shapes for multiple routes', () => {
    const results = getShapes(
      {
        route_id: ['Lo-16APR', 'Li-16APR'],
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_sj_sf',
      shape_pt_lat: 37.694_407_548_683_614,
      shape_pt_lon: -122.401_739_358_901_98,
      shape_pt_sequence: 306,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(2677);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return empty array of for invalid route', () => {
    const results = getShapes({
      route_id: 'not-valid',
    });

    expect(results).toHaveLength(0);
  });

  it('should return array of shapes by route and direction', () => {
    const routeId = 'TaSj-16APR';
    const directionId = 0;
    const results = getShapes(
      {
        route_id: routeId,
        direction_id: directionId,
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_tam_sj',
      shape_pt_lat: 37.323558,
      shape_pt_lon: -121.8919,
      shape_pt_sequence: 10051,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(114);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of shapes for specific trip_id', () => {
    const tripId = '329';
    const results = getShapes(
      {
        trip_id: tripId,
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_tam_sf',
      shape_pt_lat: 37.337_664_044_379_544,
      shape_pt_lon: -121.908_105_611_801_15,
      shape_pt_sequence: 25,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(401);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of shapes for specific service_id', () => {
    const serviceId = 'CT-16APR-Caltrain-Sunday-02';
    const results = getShapes(
      {
        service_id: serviceId,
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_sj_tam',
      shape_pt_lat: 37.294079,
      shape_pt_lon: -121.874108,
      shape_pt_sequence: 10154,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(713);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of shapes for specific shape_id', () => {
    const shapeId = 'cal_sf_tam';
    const results = getShapes(
      {
        shape_id: shapeId,
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled',
      ],
    );

    const expectedResult = {
      shape_id: 'cal_sf_tam',
      shape_pt_lat: 37.682971245836484,
      shape_pt_lon: -122.39507675170898,
      shape_pt_sequence: 88,
      shape_dist_traveled: null,
    };

    expect(results).toHaveLength(401);
    expect(results).toContainEqual(expectedResult);
  });
});
