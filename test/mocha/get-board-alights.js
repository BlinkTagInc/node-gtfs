/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getBoardAlights } from '../../index.js';

describe('getBoardAlights():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no board alights (GTFS-ride)', async () => {
    const tripId = 'fake-trip-id';

    const results = await getBoardAlights({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
