const async = require('async');
const should = require('should');
const tk = require('timekeeper');
const timeReference = new Date();

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

config.agencies = agenciesFixtures;

describe('gtfs.agencies(): ', () => {
  before((done) => {
    async.series({
      connectToDb: (next) => {
        databaseTestSupport.connect(config, next);
      },
      setupMockDate: (next) => {
        tk.freeze(timeReference);
        next();
      }
    }, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
      },
      resetMockDate: (next) => {
        tk.reset();
        next();
      }
    }, done);
  });

  beforeEach((done)=> {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return empty array if no agencies exists', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
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

  it('should return expected agency', (done) => {
    gtfs.agencies((err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);
      agencies.length.should.equal(1);

      const agency = agencies[0].toObject();

      agency.agency_key.should.equal('caltrain');
      agency.agency_id.should.equal('caltrain-ca-us');
      agency.agency_name.should.equal('Caltrain');
      agency.agency_url.should.equal('http://www.caltrain.com');
      agency.agency_timezone.should.equal('America/Los_Angeles');
      agency.agency_lang.should.equal('en');
      agency.agency_phone.should.equal('800-660-4287');

      // current fixture does not have fare url. update this if needed next time
      should.not.exist(agency.agency_fare_url);

      agency.agency_bounds.should.have.keys('sw', 'ne');
      agency.agency_bounds.sw.should.have.length(2);
      agency.agency_bounds.sw[0].should.eql(-122.406408);
      agency.agency_bounds.sw[1].should.eql(37.003084);
      agency.agency_bounds.ne.should.have.length(2);
      agency.agency_bounds.ne[0].should.eql(-121.567091);
      agency.agency_bounds.ne[1].should.eql(37.7764393371);

      agency.agency_center.should.have.length(2);
      agency.agency_center[0].should.eql(-121.9867495);
      agency.agency_center[1].should.eql(37.38976166855);

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });
});
