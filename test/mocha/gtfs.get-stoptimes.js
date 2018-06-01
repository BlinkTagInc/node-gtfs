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

describe('gtfs.getStoptimes():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl);
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return an empty array if no stoptimes exist for given agency', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencyKey = 'non_existing_agency';
    const stopId = '70011';
    const stoptimes = await gtfs.getStoptimes({
      agency_key: agencyKey,
      stop_id: stopId
    });

    should.exist(stoptimes);
    stoptimes.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return array of stoptimss for given agency, stop_id and stop_id', async () => {
    const agencyKey = 'caltrain';
    const stopId = '70011';

    const stoptimes = await gtfs.getStoptimes({
      agency_key: agencyKey,
      stop_id: stopId
    });

    should.exist(stoptimes);
    stoptimes.should.have.length(80);

    for (const stoptime of stoptimes) {
      stoptime.should.not.have.any.keys('_id');
    }
  });

  it('should return array of stoptimes for given agency, stop_id and trip_ids', async () => {
    const agencyKey = 'caltrain';
    const stopId = '70011';
    const tripId = '421a';

    const stoptimes = await gtfs.getStoptimes({
      agency_key: agencyKey,
      stop_id: stopId,
      trip_id: tripId
    });

    should.exist(stoptimes);
    stoptimes.should.have.length(1);

    for (const stoptime of stoptimes) {
      stoptime.should.not.have.any.keys('_id');
    }
  });

  it('should return array of stoptimes for given agency and trip_ids', async () => {
    const agencyKey = 'caltrain';
    const tripId = '421a';

    const stoptimes = await gtfs.getStoptimes({
      agency_key: agencyKey,
      trip_id: tripId
    });

    should.exist(stoptimes);
    stoptimes.should.have.length(24);

    for (const stoptime of stoptimes) {
      stoptime.should.not.have.any.keys('_id');
    }
  });
});
