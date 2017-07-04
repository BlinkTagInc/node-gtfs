const path = require('path');

const should = require('should');
const tk = require('timekeeper');

const timeReference = new Date();

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
  before(() => {
    return database.connect(config)
    .then(() => tk.freeze(timeReference))
  });

  after(() => {
    return database.teardown()
    .then(database.close)
    .then(() => tk.reset());
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return null if agencyKey does not exist (no agencyId provided)', () => {
    return database.teardown()
    .then(() => {
      const agencyKey = 'caltrain-NOT';

      return gtfs.getAgency(agencyKey);
    })
    .then(agencies => {
      should.not.exists(agencies);
    });
  });

  it('should return expected agency for agencyKey (no agencyId provided)', () => {
    const agencyKey = 'caltrain';

    return gtfs.getAgency(agencyKey)
    .then(agencies => {
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
    });
  });

  it('should return null if agencyKey does not exist (agencyId provided)', () => {
    return database.teardown()
    .then(() => {
      const agencyKey = 'caltrain-NOT';
      const agencyId = 'CT';
      return gtfs.getAgency(agencyKey, agencyId);
    })
    .then(agencies => {
      should.not.exists(agencies);
    });
  });

  it('should return expected agency for agencyKey and agencyId', () => {
    const agencyKey = 'caltrain';
    const agencyId = 'CT';

    return gtfs.getAgency(agencyKey, agencyId)
    .then(agencies => {
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
    });
  });
});
