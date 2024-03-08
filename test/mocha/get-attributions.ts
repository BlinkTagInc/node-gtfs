/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getAttributions } from '../../index.js';

describe('getAttributions():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no attributions exist', () => {
    const attributionId = 'fake-attribution-id';
    const results = getAttributions({
      attribution_id: attributionId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
