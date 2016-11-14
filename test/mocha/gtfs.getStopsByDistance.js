const async = require('async');
const path = require('path');
const should = require('should');

// libraries
const config = require('../config.json');
const gtfs = require('../../');


// test support
const database = require('../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20120824_0333.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByDistance(): ', () => {

  before((done) => {
    database.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      closeDb: (next) => {
        database.close(next);
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      executeDownloadScript: (next) => {
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return an empty array if no stops exist', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      const lon = -121.9867495;
      const lat = 37.38976166855;
      const radius = 100;
      gtfs.getStopsByDistance(lat, lon, radius, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });


  it('should return expected stops within given distance if they exist', (done) => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 2;
    const expectedStops = {
      'Lawrence Caltrain': {
        loc: [ -121.996982, 37.371578 ],
        agency_key: 'caltrain',
        stop_url: '',
        zone_id: '4',
        stop_lon: -121.996982,
        stop_lat: 37.371578,
        stop_desc: '137 San Zeno Way, Sunnyvale',
        stop_name: 'Lawrence Caltrain Station',
        stop_id: 'Lawrence Caltrain'
      }
    };

    gtfs.getStopsByDistance(lat, lon, radius, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(1);

      stops.forEach((stop) => {
        const expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_desc.should.equal(expectedStop.stop_desc);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.agency_key.should.equal(expectedStop.agency_key);
      });

      done();
    });
  });

  it('should return expected stops within given distance (without specifying radius) if they exist', (done) => {
    const lon = -121.915671;
    const lat = 37.340902;
    const expectedStops = {
      'College Park Caltrain': {
        loc: [ -121.914998, 37.34217 ],
        agency_key: 'caltrain',
        stop_url: '',
        zone_id: '4',
        stop_lon: -121.914998,
        stop_lat: 37.34217,
        stop_desc: '780 Stockton Avenue,San Jose',
        stop_name: 'College Park Caltrain Station',
        stop_id: 'College Park Caltrain'
      }
    };

    gtfs.getStopsByDistance(lat, lon, (err, stops) => {
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(1);

      stops.forEach((stop) => {
        const expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_desc.should.equal(expectedStop.stop_desc);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.agency_key.should.equal(expectedStop.agency_key);
      });

      done();
    });
  });
});
