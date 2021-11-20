/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getStopAttributes,
} from '../../index.js';

describe('getStopAttributes():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no stop attributes', async () => {
    const stopId = 'fake-stop-id';

    const results = await getStopAttributes({
      stop_id: stopId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
