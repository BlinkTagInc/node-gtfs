/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getPathways } from '../../index.js';

describe('getPathways():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no pathways', async () => {
    const pathwayId = 'not_real';

    const results = await getPathways({
      pathway_id: pathwayId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
