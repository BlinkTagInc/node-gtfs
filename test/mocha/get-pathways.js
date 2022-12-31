/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getPathways } from '../../index.js';

describe('getPathways():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no pathways', () => {
    const pathwayId = 'not_real';

    const results = getPathways({
      pathway_id: pathwayId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
