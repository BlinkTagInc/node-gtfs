/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getRiderships } from '../../index.js';

describe('getRiderships():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no riderships (GTFS-ride)', async () => {
    const routeId = 'fake-route-id';

    const results = await getRiderships({
      route_id: routeId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
