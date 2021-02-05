/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getFareRules():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no fare_rules', async () => {
    const routeId = 'not_real';

    const results = await gtfs.getFareRules({
      route_id: routeId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected fare_rules', async () => {
    const routeId = 'Bu-16APR';

    const results = await gtfs.getFareRules({
      route_id: routeId
    }, [
      'fare_id',
      'route_id',
      'origin_id',
      'destination_id'
    ]);

    const expectedResult = {
      fare_id: 'OW_2_20160228',
      route_id: 'Bu-16APR',
      origin_id: '6',
      destination_id: '5'
    };

    should.exist(results);
    results.length.should.equal(36);
    results.should.containEql(expectedResult);
  });
});
