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

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareRulesByRouteId(): ', () => {
  before(() => database.connect(config));

  after(() => {
    return database.teardown()
    .then(database.close);
  });

  beforeEach(() => {
    return database.teardown()
    .then(() => gtfs.import(config));
  });

  it('should return empty array if no fare_rules', () => {
    return database.teardown()
    .then(() => {
      const routeId = 'not_real';

      return gtfs.getFareRulesByRouteId(agencyKey, routeId);
    })
    .then(fareRules => {
      should.exists(fareRules);
      fareRules.should.have.length(0);
    });
  });

  it('should return expected fare_rules', () => {
    const routeId = 'Bu-16APR';

    return gtfs.getFareRulesByRouteId(agencyKey, routeId)
    .then(fareRules => {
      should.exist(fareRules);
      fareRules.length.should.equal(36);

      const fareRule = fareRules[0].toObject();

      fareRule.agency_key.should.equal(agenciesFixtures[0].agency_key);
      should.exist(fareRule.fare_id);
      fareRule.route_id.should.equal(routeId);
      should.exist(fareRule.origin_id);
      should.exist(fareRule.destination_id);
    });
  });
});
