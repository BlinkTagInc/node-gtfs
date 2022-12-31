/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTripCapacities } from '../../index.js';

describe('getTripCapacities():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no trip capacities (GTFS-ride)', () => {
    const tripId = 'fake-trip-id';

    const results = getTripCapacities({
      trip_id: tripId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
