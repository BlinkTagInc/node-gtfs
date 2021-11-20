/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getTransfers,
} from '../../index.js';

describe('getTransfers():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no transfers', async () => {
    const fromStopId = 'fake-stop-id';

    const results = await getTransfers({
      from_stop_id: fromStopId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
