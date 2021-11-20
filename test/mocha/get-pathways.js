/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getPathways,
} from '../../index.js';

describe('getPathways():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no pathways', async () => {
    const pathwayId = 'not_real';

    const results = await getPathways({
      pathway_id: pathwayId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
