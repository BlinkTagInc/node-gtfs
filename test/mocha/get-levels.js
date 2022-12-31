/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getLevels } from '../../index.js';

describe('getLevels():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no levels', () => {
    const levelId = 'not_real';

    const results = getLevels({
      level_id: levelId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
