/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getStops } from '../../index.js';

describe('getStops():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return an empty array if no stops exist', () => {
    const stopId = 'fake-stop-id';

    const results = getStops({
      stop_id: stopId,
    });
    should.exists(results);
    results.should.have.length(0);
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

    should.exist(results);
    results.length.should.equal(95);
    results.should.containEql(expectedResult);
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

    should.exist(results);
    results.length.should.equal(1);
    results.should.match(expectedResult);
  });

  it('should return array of stops if it exists for a specific route_id', () => {
    const routeId = 'Bu-16APR';

    const results = getStops(
      {
        route_id: routeId,
      },
      [],
      [['stop_id', 'ASC']]
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

    should.exist(results);
    results.length.should.equal(24);
    for (const [idx, stop] of results.entries()) {
      expectedStopIds[idx].should.equal(
        stop.stop_id,
        'The order of stops are expected to be the same'
      );
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
      [['stop_id', 'ASC']]
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

    should.exist(results);
    results.length.should.equal(12);
    for (const [idx, stop] of results.entries()) {
      expectedStopIds[idx].should.equal(
        stop.stop_id,
        'The order of stops are expected to be the same'
      );
    }
  });

  it('should return array of stops for a specific trip_id', () => {
    const tripId = '427a';

    const results = getStops(
      {
        trip_id: tripId,
      },
      [],
      [['stop_id', 'ASC']]
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

    should.exist(results);
    results.length.should.equal(24);
    for (const [idx, stop] of results.entries()) {
      expectedStopIds[idx].should.equal(
        stop.stop_id,
        'The order of stops are expected to be the same'
      );
    }
  });

  it('should return array of stops if it exists for a specific shape_id', () => {
    const shapeId = 'cal_sf_tam';

    const results = getStops(
      {
        shape_id: shapeId,
      },
      [],
      [['stop_id', 'ASC']]
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

    should.exist(results);
    results.length.should.equal(25);
    for (const [idx, stop] of results.entries()) {
      expectedStopIds[idx].should.equal(
        stop.stop_id,
        'The order of stops are expected to be the same'
      );
    }
  });
});
