/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getDirections } from '../../index.js';

describe('getDirections():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no directions', async () => {
    const fareRouteId = 'not_real';

    const results = await getDirections({
      route_id: fareRouteId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
