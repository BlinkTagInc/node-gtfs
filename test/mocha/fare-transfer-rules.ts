/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getFareTransferRules,
} from '../../index.js';

describe('getFareTransferRules():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_transfer_rules exist', () => {
    const transferId = 'fake-transfer-id';
    const results = getFareTransferRules({
      transfer_id: transferId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
