/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getRouteAttributes,
} from '../../index.js';

describe('getRouteAttributes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no route attributes', () => {
    const routeId = 'fake-route-id';

    const results = getRouteAttributes({
      route_id: routeId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
