const path = require('path');

const async = require('async');
const should = require('should');
const tk = require('timekeeper');

const timeReference = new Date();

// libraries
const config = require('../config.json');
const gtfs = require('../../');


const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getAgency(): ', () => {
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
        gtfs.import(config)
        .then(next)
        .catch(next);
      }
    }, done);
  });

  it('should return null if agencyKey does not exist (no agencyId provided)', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'caltrain-NOT';
      gtfs.getAgency(agencyKey, (err, agencies) => {
        should.not.exists(err);
        should.not.exists(agencies);

        done();
      });
    });
  });

  it('should return expected agency for agencyKey (no agencyId provided)', done => {
    const agencyKey = 'caltrain';
    gtfs.getAgency(agencyKey, (err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);

      const agency = agencies.toObject();

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

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });

  it('should return null if agencyKey does not exist (agencyId provided)', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const agencyKey = 'caltrain-NOT';
      const agencyId = 'CT';
      gtfs.getAgency(agencyKey, agencyId, (err, agencies) => {
        should.not.exists(err);
        should.not.exists(agencies);

        done();
      });
    });
  });

  it('should return expected agency for agencyKey and agencyId', done => {
    const agencyKey = 'caltrain';
    const agencyId = 'CT';
    gtfs.getAgency(agencyKey, agencyId, (err, agencies) => {
      should.not.exist(err);
      should.exist(agencies);

      const agency = agencies.toObject();

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

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });
});
