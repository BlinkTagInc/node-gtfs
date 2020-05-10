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

describe('gtfs.getDirectionsByRoute():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return empty array if no route', async () => {
    await mongoose.connection.db.dropDatabase();

    const routeId = 'not_real';
    const directions = await gtfs.getDirectionsByRoute({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exist(directions);
    directions.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return expected directions', async () => {
    const routeId = 'Bu-16APR';

    const directions = await gtfs.getDirectionsByRoute({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exist(directions);
    directions.should.have.length(3);

    const direction = directions[0];

    should.exist(direction.route_id);
    should.exist(direction.trip_headsign);
    should.exist(direction.direction_id);
  });
});
