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

describe('gtfs.agencies(): ', () => {
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

  it('should return empty array if no agencies exist', () => {
    return database.teardown()
    .then(() => gtfs.agencies())
    .then(agencies => {
      should.exists(agencies);
      agencies.should.have.length(0);
    });
  });

  it('should return expected agency', () => {
    return gtfs.agencies()
    .then(agencies => {
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

      // Current fixture does not have fare url. update this if needed next time
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
