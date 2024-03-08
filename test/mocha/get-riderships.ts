/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getRiderships } from '../../index.js';

describe('getRiderships():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no riderships (GTFS-ride)', () => {
    const routeId = 'fake-route-id';

    const results = getRiderships({
      route_id: routeId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
