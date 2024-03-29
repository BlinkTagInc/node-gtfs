/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getNetworks } from '../../index.js';

describe('getNetworks():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no networks', () => {
    const networkId = 'not_real';

    const results = getNetworks({
      network_id: networkId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
