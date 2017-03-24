const path = require('path');

const async = require('async');
const should = require('should');
const tk = require('timekeeper');

const timeReference = new Date();

// libraries
const config = require('../config.json');
const gtfs = require('../../');

// test support
const database = require('../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.agencies(): ', () => {
  before(done => {
    async.series({
      connectToDb: next => {
        database.connect(config, next);
      },
      setupMockDate: next => {
        tk.freeze(timeReference);
        next();
      }
    }, done);
  });

  after(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      closeDb: next => {
        database.close(next);
      },
      resetMockDate: next => {
        tk.reset();
        next();
      }
    }, done);
  });

  beforeEach(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      executeDownloadScript: next => {
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return empty array if no agencies exist', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      gtfs.agencies((err, agencies) => {
        should.not.exists(err);
        should.exists(agencies);
        agencies.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected agency', done => {
    gtfs.agencies((err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);
      agencies.length.should.equal(1);

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
      agency.agency_bounds.sw[0].should.eql(-122.412076);
      agency.agency_bounds.sw[1].should.eql(37.003485);
      agency.agency_bounds.ne.should.have.length(2);
      agency.agency_bounds.ne[0].should.eql(-121.566088);
      agency.agency_bounds.ne[1].should.eql(37.776439);

      agency.agency_center.should.have.length(2);
      agency.agency_center[0].should.eql(-121.989082);
      agency.agency_center[1].should.eql(37.389962);

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });
});
