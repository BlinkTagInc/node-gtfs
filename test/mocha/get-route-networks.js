/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getRouteNetworks } from '../../index.js';

describe('getRouteNetworks():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no route_networks', () => {
    const networkId = 'not_real';

    const results = getRouteNetworks({
      network_id: networkId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
