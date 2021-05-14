/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getFrequencies } from '../../index.js';

describe('getFrequencies():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no frequencies', async () => {
    const tripId = 'not_real';

    const results = await getFrequencies({
      trip_id: tripId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
