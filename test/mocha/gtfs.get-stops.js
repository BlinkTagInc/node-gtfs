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

describe('gtfs.getStops(): ', () => {
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
      const agencyKey = 'non_existing_agency';
      return gtfs.getStops(agencyKey);
    })
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(0);
    });
  });

  it('should return array of stops for given agency', () => {
    const agencyKey = 'caltrain';

    return gtfs.getStops(agencyKey)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(95);
    });
  });

  it('should return array of stops for given agency, and stopIds', () => {
    const agencyKey = 'caltrain';
    const stopIds = [
      '70031',
      '70061'
    ];

    return gtfs.getStops(agencyKey, stopIds)
    .then(stops => {
      should.exist(stops);
      stops.should.have.length(2);
    });
  });
});
