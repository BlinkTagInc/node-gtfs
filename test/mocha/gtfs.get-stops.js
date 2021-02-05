/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getStops():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return an empty array if no stops exist', async () => {
    const stopId = 'fake-stop-id';

    const results = await gtfs.getStops({
      stop_id: stopId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return array of stops', async () => {
    const results = await gtfs.getStops();

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
      platform_code: null
    };

    should.exist(results);
    results.length.should.equal(95);
    results.should.containEql(expectedResult);
  });

  it('should return array of stops for a specific stopId', async () => {
    const stopId = '70031';

    const results = await gtfs.getStops({
      stop_id: stopId
    });

    const expectedResult = [{
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
      platform_code: 'NB'
    }];

    should.exist(results);
    results.length.should.equal(1);
    results.should.match(expectedResult);
  });

  it('should return array of stops if it exists for a specific route_id', async () => {
    const routeId = 'Bu-16APR';

    const results = await gtfs.getStops({
      route_id: routeId
    },
    [],
    [
      ['stop_id', 'ASC']
    ]);

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
      '70272'
    ];

    should.exist(results);
    results.length.should.equal(24);
    results.forEach((stop, idx) => {
      expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
    });
  });

  it('should return array of stops if it exists for a specific route_id and direction_id', async () => {
    const routeId = 'Bu-16APR';
    const directionId = 1;

    const results = await gtfs.getStops({
      route_id: routeId,
      direction_id: directionId
    },
    [],
    [
      ['stop_id', 'ASC']
    ]);

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
      '70272'
    ];

    should.exist(results);
    results.length.should.equal(12);
    results.forEach((stop, idx) => {
      expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
    });
  });

  it('should return array of stops for a specific trip_id', async () => {
    const tripId = '427a';

    const results = await gtfs.getStops({
      trip_id: tripId
    },
    [],
    [
      ['stop_id', 'ASC']
    ]);

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
      '70261'
    ];

    should.exist(results);
    results.length.should.equal(24);
    results.forEach((stop, idx) => {
      expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
    });
  });
});
