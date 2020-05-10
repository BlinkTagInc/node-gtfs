/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStops():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return an empty array if no stops exist for given agency', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencyKey = 'non_existing_agency';
    const stops = await gtfs.getStops({
      agency_key: agencyKey
    });

    should.exist(stops);
    stops.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return array of stops for given agency', async () => {
    const agencyKey = 'caltrain';

    const stops = await gtfs.getStops({
      agency_key: agencyKey
    });

    should.exist(stops);
    stops.should.have.length(95);

    for (const stop of stops) {
      stop.should.not.have.any.keys('_id');
    }
  });

  it('should return array of stops for given agency, and stopIds', async () => {
    const agencyKey = 'caltrain';
    const stopIds = [
      '70031',
      '70061'
    ];

    const stops = await gtfs.getStops({
      agency_key: agencyKey,
      stop_id: { $in: stopIds }
    });

    should.exist(stops);
    stops.should.have.length(2);

    for (const stop of stops) {
      stop.should.not.have.any.keys('_id');
    }
  });

  it('should return array of stops for given agency and stop_code', async () => {
    const agencyKey = 'caltrain';
    const stopCodes = [
      '70031',
      '70061'
    ];

    const stops = await gtfs.getStops({
      agency_key: agencyKey,
      stop_code: { $in: stopCodes }
    });

    should.exist(stops);
    stops.should.have.length(2);

    for (const stop of stops) {
      stop.should.not.have.any.keys('_id');
    }
  });

  it('should return an empty array if no stops exists for given agency, route and direction', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencyKey = 'non_existing_agency';
    const routeId = 'non_existing_route_id';
    const directionId = '0';
    const stops = await gtfs.getStops({
      agency_key: agencyKey,
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(stops);
    stops.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return array of stops if it exists for given agency, route and direction', async () => {
    const agencyKey = 'caltrain';
    const routeId = 'Bu-16APR';
    const directionId = 0;

    const expectedStopIds = [
      '70261',
      '70271',
      '70221',
      '70211',
      '70161',
      '70171',
      '70141',
      '70111',
      '70021',
      '70091',
      '70061',
      '70011'
    ];

    const stops = await gtfs.getStops({
      agency_key: agencyKey,
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(stops);
    stops.should.have.length(12);

    stops.forEach((stop, idx) => {
      expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
    });

    for (const stop of stops) {
      stop.should.not.have.any.keys('_id');
    }
  });

  it('should return array of stops if it exists for given agency, route and direction (opposite direction)', async () => {
    const agencyKey = 'caltrain';
    const routeId = 'Bu-16APR';
    const directionId = 1;

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
      '70272',
      '70262'
    ];

    const stops = await gtfs.getStops({
      agency_key: agencyKey,
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(stops);
    stops.should.have.length(12);

    stops.forEach((stop, idx) => {
      expectedStopIds[idx].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
    });

    for (const stop of stops) {
      stop.should.not.have.any.keys('_id');
    }
  });

  it('should return an empty array if no stops exist', async () => {
    await mongoose.connection.db.dropDatabase();

    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 100;

    const stops = await gtfs.getStops({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(stops);
    stops.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected stops within given distance if they exist', async () => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 2;
    const expectedStops = {
      ctla: {
        stop_id: 'ctla',
        stop_code: '',
        stop_name: 'Lawrence Caltrain',
        stop_lat: 37.370815,
        stop_lon: -121.997258,
        zone_id: '',
        stop_url: 'http://www.caltrain.com/stations/lawrencestation.html',
        location_type: 1,
        parent_station: '',
        platform_code: '',
        wheelchair_boarding: 1,
        agency_key: 'caltrain',
        loc: [-121.997258, 37.370815]
      },
      70231: {
        stop_id: '70231',
        stop_code: '70231',
        stop_name: 'Lawrence Caltrain',
        stop_lat: 37.370598,
        stop_lon: -121.997114,
        zone_id: '4',
        stop_url: 'http://www.caltrain.com/stations/lawrencestation.html',
        location_type: 0,
        parent_station: 'ctla',
        platform_code: 'NB',
        wheelchair_boarding: 1,
        agency_key: 'caltrain',
        loc: [-121.997114, 37.370598]
      },
      70232: {
        stop_id: '70232',
        stop_code: '70232',
        stop_name: 'Lawrence Caltrain',
        stop_lat: 37.370484,
        stop_lon: -121.997135,
        zone_id: '4',
        stop_url: 'http://www.caltrain.com/stations/lawrencestation.html',
        location_type: 0,
        parent_station: 'ctla',
        platform_code: 'SB',
        wheelchair_boarding: 1,
        agency_key: 'caltrain',
        loc: [-121.997135, 37.370484]
      }
    };

    const stops = await gtfs.getStops({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(stops);
    stops.should.have.length(3);

    for (const stop of stops) {
      const expectedStop = expectedStops[stop.stop_id];

      should.exist(expectedStop);
      expectedStop.should.match(stop);
    }
  });

  it('should return expected stops within given distance (without specifying radius) if they exist', async () => {
    const lon = -121.915671;
    const lat = 37.340902;
    const expectedStops = {
      ctco: {
        stop_id: 'ctco',
        stop_code: '',
        stop_name: 'College Park Caltrain',
        stop_lat: 37.34217,
        stop_lon: -121.914998,
        zone_id: '',
        stop_url: 'http://www.caltrain.com/stations/collegeparkstation.html',
        location_type: 1,
        parent_station: '',
        platform_code: '',
        wheelchair_boarding: 2,
        agency_key: 'caltrain',
        loc: [-121.914998, 37.34217]
      },
      70252: {
        stop_id: '70252',
        stop_code: '70252',
        stop_name: 'College Park Caltrain',
        stop_lat: 37.342338,
        stop_lon: -121.914677,
        zone_id: '4',
        stop_url: 'http://www.caltrain.com/stations/collegeparkstation.html',
        location_type: 0,
        parent_station: 'ctco',
        platform_code: 'SB',
        wheelchair_boarding: 2,
        agency_key: 'caltrain',
        loc: [-121.914677, 37.342338]
      },
      70251: {
        stop_id: '70251',
        stop_code: '70251',
        stop_name: 'College Park Caltrain',
        stop_lat: 37.342384,
        stop_lon: -121.9146,
        zone_id: '4',
        stop_url: 'http://www.caltrain.com/stations/collegeparkstation.html',
        location_type: 0,
        parent_station: 'ctco',
        platform_code: 'NB',
        wheelchair_boarding: 2,
        agency_key: 'caltrain',
        loc: [-121.9146, 37.342384]
      }
    };

    const stops = await gtfs.getStops({
      within: {
        lat,
        lon
      }
    });

    should.exist(stops);
    stops.should.have.length(3);

    for (const stop of stops) {
      const expectedStop = expectedStops[stop.stop_id];

      should.exist(expectedStop);
      expectedStop.should.match(stop);
    }
  });
});
