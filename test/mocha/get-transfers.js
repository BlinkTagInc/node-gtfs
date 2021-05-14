/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getTransfers } from '../../index.js';

describe('getTransfers():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no transfers', async () => {
    const fromStopId = 'fake-stop-id';

    const results = await getTransfers({
      from_stop_id: fromStopId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
