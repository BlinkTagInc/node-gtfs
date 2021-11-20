/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getDirections,
} from '../../index.js';

describe('getDirections():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no directions', async () => {
    const fareRouteId = 'not_real';

    const results = await getDirections({
      route_id: fareRouteId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
