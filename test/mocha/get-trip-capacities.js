/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getTripCapacities } from '../../index.js';

describe('getTripCapacities():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no trip capacities (GTFS-ride)', async () => {
    const tripId = 'fake-trip-id';

    const results = await getTripCapacities({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
