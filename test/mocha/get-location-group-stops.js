/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getLocationGroupStops,
} from '../../index.js';

describe('getLocationGroupStops():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no location group stops', () => {
    const locationGroupId = 'not_real';

    const results = getLocationGroupStops({
      location_group_id: locationGroupId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
