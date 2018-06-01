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

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getFareRules():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl);
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no fare_rules', async () => {
    await mongoose.connection.db.dropDatabase();

    const routeId = 'not_real';

    const fareRules = await gtfs.getFareRules({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exists(fareRules);
    fareRules.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected fare_rules', async () => {
    const routeId = 'Bu-16APR';

    const fareRules = await gtfs.getFareRules({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exist(fareRules);
    fareRules.length.should.equal(36);

    const fareRule = fareRules[0];

    fareRule.should.not.have.any.keys('_id');
    fareRule.agency_key.should.equal(agenciesFixtures[0].agency_key);
    should.exist(fareRule.fare_id);
    fareRule.route_id.should.equal(routeId);
    should.exist(fareRule.origin_id);
    should.exist(fareRule.destination_id);
  });
});
