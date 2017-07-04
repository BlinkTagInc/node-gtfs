const path = require('path');

const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByDistance(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return an empty array if no stops exist', () => {
    return database.teardown()
    .then(() => {
      const lon = -121.9867495;
      const lat = 37.38976166855;
      const radius = 100;

      return gtfs.getStopsByDistance(lat, lon, radius);
    })
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(0);
    });
  });

  it('should return expected stops within given distance if they exist', () => {
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

    return gtfs.getStopsByDistance(lat, lon, radius)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(3);

      stops.forEach(stop => {
        const expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_code.should.equal(expectedStop.stop_code);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.zone_id.should.equal(expectedStop.zone_id);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.location_type.should.equal(expectedStop.location_type);
        stop.parent_station.should.equal(expectedStop.parent_station);
        stop.wheelchair_boarding.should.equal(expectedStop.wheelchair_boarding);
        stop.agency_key.should.equal(expectedStop.agency_key);
      });
    });
  });

  it('should return expected stops within given distance (without specifying radius) if they exist', () => {
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

    return gtfs.getStopsByDistance(lat, lon)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(3);

      stops.forEach(stop => {
        const expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_code.should.equal(expectedStop.stop_code);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.zone_id.should.equal(expectedStop.zone_id);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.location_type.should.equal(expectedStop.location_type);
        stop.parent_station.should.equal(expectedStop.parent_station);
        stop.wheelchair_boarding.should.equal(expectedStop.wheelchair_boarding);
        stop.agency_key.should.equal(expectedStop.agency_key);
      });
    });
  });
});
