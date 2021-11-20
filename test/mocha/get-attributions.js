/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getAttributions,
} from '../../index.js';

describe('getAttributions():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no attributions exist', async () => {
    const attributionId = 'fake-attribution-id';
    const results = await getAttributions({
      attribution_id: attributionId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
