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

describe('gtfs.getStopsByStopCode(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return an empty array if no stops exist for given agency', () => {
    return database.teardown()
    .then(() => {
      const agency_key = 'non_existing_agency';
      return gtfs.getStops(agency_key);
    })
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(0);
    });
  });

  it('should return array of stops for given agency', () => {
    const agency_key = 'caltrain';

    return gtfs.getStopsByStopCode(agency_key)
    .then(stops => {
      should.exist(stops);

      stops.should.have.length(95);
    });
  });

  it('should return array of stops for given agency, and stop_ids', () => {
    const agency_key = 'caltrain';
    const stop_codes = [
      '70031',
      '70061'
    ];

    return gtfs.getStopsByStopCode(agency_key, stop_codes)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(2);
    });
  });
});
