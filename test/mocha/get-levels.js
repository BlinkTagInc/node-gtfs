/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, getDb, closeDb, importGtfs, getLevels } from '../../index.js';

describe('getLevels():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no levels', async () => {
    const levelId = 'not_real';

    const results = await getLevels({
      level_id: levelId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
