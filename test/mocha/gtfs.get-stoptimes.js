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

describe('gtfs.getStoptimes():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return an empty array if no stoptimes exist for given agency', async () => {
    await database.teardown();

    const agencyKey = 'non_existing_agency';
    const stopId = '70011';
    const stoptimes = await gtfs.getStoptimes({
      agency_key: agencyKey,
      stop_id: stopId
    });

    should.exist(stoptimes);
    stoptimes.should.have.length(0);
  });

  it('should return array of stoptimss for given agency and stop_id', async () => {
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

  it('should return array of stoptimes for given agency and trip_ids', async () => {
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
});
