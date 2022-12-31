/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFareLegRules } from '../../index.js';

describe('getFareLegRules():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_leg_rules exist', () => {
    const legGroupId = 'fake-leg-group-id';
    const results = getFareLegRules({
      leg_group_id: legGroupId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
