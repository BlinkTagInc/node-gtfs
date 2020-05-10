/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');
const tk = require('timekeeper');

const timeReference = new Date();

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getAgencies():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    tk.freeze(timeReference);
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
    tk.reset();
  });

  it('should return empty array if no agencies exist', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencies = await gtfs.getAgencies();
    should.exists(agencies);
    agencies.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected agencies with no query', async () => {
    const agencies = await gtfs.getAgencies();
    should.exist(agencies);
    agencies.length.should.equal(1);

    const agency = agencies[0];

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
  });

  it('should return empty array if agency_key does not exist', async () => {
    const agencies = await gtfs.getAgencies({
      agency_key: 'caltrain-NOT',
      agency_id: 'CT'
    });
    should.exists(agencies);
    agencies.should.have.length(0);
  });

  it('should return expected agency for agency_key and agency_id', async () => {
    const agencyKey = 'caltrain';
    const agencyId = 'CT';

    const agencies = await gtfs.getAgencies({
      agency_key: agencyKey,
      agency_id: agencyId
    });
    should.exist(agencies);
    agencies.length.should.equal(1);

    const agency = agencies[0];

    agency.should.not.have.any.keys('_id');
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
  });

  it('should return only specific keys for expected agency for agency_key and agency_id', async () => {
    const agencyKey = 'caltrain';
    const agencyId = 'CT';

    const agencies = await gtfs.getAgencies({
      agency_key: agencyKey,
      agency_id: agencyId
    }, {
      _id: 0,
      agency_url: 1,
      agency_lang: 1
    });

    const expectedAgency = {
      agency_url: 'http://www.caltrain.com',
      agency_lang: 'en'
    };

    should.exist(agencies);
    agencies.length.should.equal(1);

    const agency = agencies[0];

    expectedAgency.should.match(agency);
  });

  it('should return empty array if no agencies exist within radius', async () => {
    const lon = -100.9867495;
    const lat = 7.38976166855;
    const radius = 100;

    const agencies = await gtfs.getAgencies({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(agencies);
    agencies.should.have.length(0);
  });

  it('should return expected agencies within given distance', async () => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 100;

    const agencies = await gtfs.getAgencies({
      within: {
        lat,
        lon,
        radius
      }
    });

    should.exist(agencies);
    agencies.should.have.length(1);
    agencies[0].agency_key.should.equal('caltrain');
    agencies[0].should.not.have.any.keys('_id');
  });

  it('should return expected agencies within given distance (without specifying radius)', async () => {
    const lon = -121.9867495;
    const lat = 37.38976166855;

    const agencies = await gtfs.getAgencies({
      within: {
        lat,
        lon
      }
    });

    should.exist(agencies);
    agencies.should.have.length(1);

    const agency = agencies[0];
    agency.should.not.have.any.keys('_id');
    agency.agency_key.should.equal('caltrain');
    agency.agency_id.should.equal('CT');
    agency.agency_name.should.equal('Caltrain');
    agency.agency_url.should.equal('http://www.caltrain.com');
    agency.agency_timezone.should.equal('America/Los_Angeles');
    agency.agency_lang.should.equal('en');
    agency.agency_phone.should.equal('800-660-4287');

    // Current fixture does not have fare url. Update this if needed next time
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
  });
});
