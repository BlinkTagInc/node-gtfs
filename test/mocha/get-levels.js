/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getLevels } from '../../index.js';

describe('getLevels():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no levels', async () => {
    const levelId = 'not_real';

    const results = await getLevels({
      level_id: levelId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
