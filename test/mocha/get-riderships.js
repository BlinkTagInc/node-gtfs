/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getRiderships,
} from '../../index.js';

describe('getRiderships():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no riderships (GTFS-ride)', async () => {
    const routeId = 'fake-route-id';

    const results = await getRiderships({
      route_id: routeId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
