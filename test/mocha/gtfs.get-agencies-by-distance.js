const path = require('path');

const async = require('async');
const should = require('should');

// Libraries
const config = require('../config.json');
const gtfs = require('../../');


const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getAgenciesByDistance(): ', () => {
  before(done => {
    database.connect(config, done);
  });

  after(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      closeDb: next => {
        database.close(next);
      }
    }, done);
  });

  beforeEach(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      executeDownloadScript: next => {
        gtfs.import(config)
        .then(next)
        .catch(next);
      }
    }, done);
  });

  it('should return empty array if no agencies exist', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const lon = -121.9867495;
      const lat = 37.38976166855;
      const radius = 100;
      gtfs.getAgenciesByDistance(lat, lon, radius, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return empty array if no agencies within given distance exist', done => {
    const lon = -127.9867495;
    const lat = 40.38976166855;
    const radius = 100;
    gtfs.getAgenciesByDistance(lat, lon, radius, (err, res) => {
      should.not.exist(err);
      should.exist(res);
      res.should.have.length(0);
      done();
    });
  });

  it('should return expected agencies within given distance', done => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 100;
    gtfs.getAgenciesByDistance(lat, lon, radius, (err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);
      agencies.should.have.length(1);
      agencies[0].agency_key.should.equal('caltrain');
      done();
    });
  });

  it('should return expected agencies within given distance (without specifying radius)', done => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    gtfs.getAgenciesByDistance(lat, lon, (err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);
      agencies.should.have.length(1);

      const agency = agencies[0].toObject();
      agency.agency_key.should.equal('caltrain');
      agency.agency_id.should.equal('CT');
      agency.agency_name.should.equal('Caltrain');
      agency.agency_url.should.equal('http://www.caltrain.com');
      agency.agency_timezone.should.equal('America/Los_Angeles');
      agency.agency_lang.should.equal('en');
      agency.agency_phone.should.equal('800-660-4287');

      // current fixture does not have fare url. update this if needed next time
      should.not.exist(agency.agency_fare_url);

      agency.agency_bounds.should.have.keys('sw', 'ne');
      agency.agency_bounds.sw.should.have.length(2);
      agency.agency_bounds.sw[0].should.eql(-122.4131441116333);
      agency.agency_bounds.sw[1].should.eql(37.003485);
      agency.agency_bounds.ne.should.have.length(2);
      agency.agency_bounds.ne[0].should.eql(-121.566088);
      agency.agency_bounds.ne[1].should.eql(37.776439059278346);

      agency.agency_center.should.have.length(2);
      agency.agency_center[0].should.eql(-121.98961605581664);
      agency.agency_center[1].should.eql(37.38996202963917);
      done();
    });
  });
});
