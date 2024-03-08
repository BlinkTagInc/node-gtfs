/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getDirections } from '../../index.js';

describe('getDirections():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no directions', () => {
    const fareRouteId = 'not_real';

    const results = getDirections({
      route_id: fareRouteId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
