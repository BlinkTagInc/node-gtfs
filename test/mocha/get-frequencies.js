/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getFrequencies,
} from '../../index.js';

describe('getFrequencies():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no frequencies', async () => {
    const tripId = 'not_real';

    const results = await getFrequencies({
      trip_id: tripId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
