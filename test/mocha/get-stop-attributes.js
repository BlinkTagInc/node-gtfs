/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getStopAttributes } from '../../index.js';

describe('getStopAttributes():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no stop attributes', async () => {
    const stopId = 'fake-stop-id';

    const results = await getStopAttributes({
      stop_id: stopId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
