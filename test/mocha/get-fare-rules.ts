/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFareRules } from '../../index.js';

describe('getFareRules():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_rules', () => {
    const routeId = 'not_real';

    const results = getFareRules({
      route_id: routeId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected fare_rules', () => {
    const routeId = 'Bu-16APR';

    const results = getFareRules(
      {
        route_id: routeId,
      },
      ['fare_id', 'route_id', 'origin_id', 'destination_id']
    );

    const expectedResult = {
      fare_id: 'OW_2_20160228',
      route_id: 'Bu-16APR',
      origin_id: '6',
      destination_id: '5',
    };

    should.exist(results);
    results.length.should.equal(36);
    results.should.containEql(expectedResult);
  });
});
