import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getStops } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStops():', () => {
  it('should return an empty array if no stops exist', () => {
    const stopId = 'fake-stop-id';

    const results = getStops({
      stop_id: stopId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return array of stops', () => {
    const results = getStops();

    const expectedResult = {
      stop_id: 'ctbu',
      stop_code: null,
      stop_name: 'Burlingame Caltrain',
      tts_stop_name: null,
      stop_desc: null,
      stop_lat: 37.579719,
      stop_lon: -122.345266,
      zone_id: null,
      stop_url: 'http://www.caltrain.com/stations/burlingamestation.html',
      location_type: 1,
      parent_station: null,
      stop_timezone: null,
      wheelchair_boarding: 1,
      level_id: null,
      platform_code: null,
    };

    expect(results).toHaveLength(95);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return array of stops for a specific stopId', () => {
    const stopId = '70031';

    const results = getStops({
      stop_id: stopId,
    });

    const expectedResult = [
      {
        stop_id: '70031',
        stop_code: '70031',
        stop_name: 'Bayshore Caltrain',
        tts_stop_name: null,
        stop_desc: null,
        stop_lat: 37.709537,
        stop_lon: -122.401586,
        zone_id: '1',
        stop_url: 'http://www.caltrain.com/stations/bayshorestation.html',
        location_type: 0,
        parent_station: 'ctba',
        stop_timezone: null,
        wheelchair_boarding: 1,
        level_id: null,
        platform_code: 'NB',
      },
    ];

    expect(results).toHaveLength(1);
    expect(results).toEqual(expectedResult);
  });

  it('should return array of stops if it exists for a specific route_id', () => {
    const routeId = 'Bu-16APR';

    const results = getStops(
      {
        route_id: routeId,
      },
      [],
      [['stop_id', 'ASC']],
    );

    const expectedStopIds = [
      '70011',
      '70012',
      '70021',
      '70022',
      '70061',
      '70062',
      '70091',
      '70092',
      '70111',
      '70112',
      '70141',
      '70142',
      '70161',
      '70162',
      '70171',
      '70172',
      '70211',
      '70212',
      '70221',
      '70222',
      '70261',
      '70262',
      '70271',
      '70272',
    ];

    expect(results).toHaveLength(24);
    for (const [idx, stop] of results.entries()) {
      expect(expectedStopIds[idx]).toEqual(stop.stop_id);
    }
  });

  it('should return array of stops if it exists for a specific route_id and direction_id', () => {
    const routeId = 'Bu-16APR';
    const directionId = 1;

    const results = getStops(
      {
        route_id: routeId,
        direction_id: directionId,
      },
      [],
      [['stop_id', 'ASC']],
    );

    const expectedStopIds = [
      '70012',
      '70022',
      '70062',
      '70092',
      '70112',
      '70142',
      '70162',
      '70172',
      '70212',
      '70222',
      '70262',
      '70272',
    ];

    expect(results).toHaveLength(12);
    for (const [idx, stop] of results.entries()) {
      expect(expectedStopIds[idx]).toEqual(stop.stop_id);
    }
  });

  it('should return array of stops for a specific trip_id', () => {
    const tripId = '427a';

    const results = getStops(
      {
        trip_id: tripId,
      },
      [],
      [['stop_id', 'ASC']],
    );

    const expectedStopIds = [
      '70011',
      '70021',
      '70031',
      '70041',
      '70051',
      '70061',
      '70071',
      '70081',
      '70091',
      '70101',
      '70111',
      '70121',
      '70131',
      '70141',
      '70151',
      '70161',
      '70171',
      '70191',
      '70201',
      '70211',
      '70221',
      '70231',
      '70241',
      '70261',
    ];

    expect(results).toHaveLength(24);
    for (const [idx, stop] of results.entries()) {
      expect(expectedStopIds[idx]).toEqual(stop.stop_id);
    }
  });

  it('should return array of stops if it exists for a specific shape_id', () => {
    const shapeId = 'cal_sf_tam';

    const results = getStops(
      {
        shape_id: shapeId,
      },
      [],
      [['stop_id', 'ASC']],
    );

    const expectedStopIds = [
      '70012',
      '70021',
      '70022',
      '70032',
      '70042',
      '70052',
      '70062',
      '70082',
      '70092',
      '70102',
      '70112',
      '70122',
      '70132',
      '70142',
      '70162',
      '70172',
      '70192',
      '70202',
      '70212',
      '70222',
      '70232',
      '70242',
      '70252',
      '70262',
      '70272',
    ];

    expect(results).toHaveLength(25);
    for (const [idx, stop] of results.entries()) {
      expect(expectedStopIds[idx]).toEqual(stop.stop_id);
    }
  });

  it('should return array of stops for bounding box query', () => {
    const distance = 100;
    const stopLatitude = 37.709538;
    const stopLongitude = -122.401586;

    const results = getStops(
      {
        stop_lat: stopLatitude,
        stop_lon: stopLongitude,
      },
      [],
      [],
      { bounding_box_side_m: distance },
    );

    const expectedResult = [
      {
        stop_id: '70031',
        stop_code: '70031',
        stop_name: 'Bayshore Caltrain',
        tts_stop_name: null,
        stop_desc: null,
        stop_lat: 37.709537,
        stop_lon: -122.401586,
        zone_id: '1',
        stop_url: 'http://www.caltrain.com/stations/bayshorestation.html',
        location_type: 0,
        parent_station: 'ctba',
        stop_timezone: null,
        wheelchair_boarding: 1,
        level_id: null,
        platform_code: 'NB',
      },
      {
        stop_id: 'ctba',
        stop_code: null,
        stop_name: 'Bayshore Caltrain',
        tts_stop_name: null,
        stop_desc: null,
        stop_lat: 37.709544,
        stop_lon: -122.401318,
        zone_id: null,
        stop_url: 'http://www.caltrain.com/stations/bayshorestation.html',
        location_type: 1,
        parent_station: null,
        stop_timezone: null,
        wheelchair_boarding: 1,
        level_id: null,
        platform_code: null,
      },
      {
        stop_id: '70032',
        stop_code: '70032',
        stop_name: 'Bayshore Caltrain',
        tts_stop_name: null,
        stop_desc: null,
        stop_lat: 37.709544,
        stop_lon: -122.40198,
        zone_id: '1',
        stop_url: 'http://www.caltrain.com/stations/bayshorestation.html',
        location_type: 0,
        parent_station: 'ctba',
        stop_timezone: null,
        wheelchair_boarding: 1,
        level_id: null,
        platform_code: 'SB',
      },
    ];

    // Ensure results are sorted by distance
    expect(results).toEqual(expectedResult);
  });
});
