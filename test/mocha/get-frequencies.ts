/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFrequencies } from '../../index.js';

describe('getFrequencies():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no frequencies', () => {
    const tripId = 'not_real';

    const results = getFrequencies({
      trip_id: tripId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
