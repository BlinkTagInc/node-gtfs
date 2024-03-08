/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTransfers } from '../../index.js';

describe('getTransfers():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no transfers', () => {
    const fromStopId = 'fake-stop-id';

    const results = getTransfers({
      from_stop_id: fromStopId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
