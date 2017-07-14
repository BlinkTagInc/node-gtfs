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

describe('gtfs.getFareRulesByRoute():', () => {
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

  it('should return empty array if no fare_rules', async () => {
    await database.teardown();

    const routeId = 'not_real';

    const fareRules = await gtfs.getFareRules({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exists(fareRules);
    fareRules.should.have.length(0);
  });

  it('should return expected fare_rules', async () => {
    const routeId = 'Bu-16APR';

    const fareRules = await gtfs.getFareRules({
      agency_key: agencyKey,
      route_id: routeId
    });

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
