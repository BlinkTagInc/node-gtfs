/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getAttributions } from '../../index.js';

describe('getAttributions():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no attributions exist', async () => {
    const attributionId = 'fake-attribution-id';
    const results = await getAttributions({
      attribution_id: attributionId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
