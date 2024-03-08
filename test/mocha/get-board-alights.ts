/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getBoardAlights } from '../../index.js';

describe('getBoardAlights():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no board alights (GTFS-ride)', () => {
    const tripId = 'fake-trip-id';

    const results = getBoardAlights({
      trip_id: tripId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
