/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getLocationGroups } from '../../index.js';

describe('getLocationGroups():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no location groups', () => {
    const locationGroupId = 'not_real';

    const results = getLocationGroups({
      location_group_id: locationGroupId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
