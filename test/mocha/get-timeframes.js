/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTimeframes } from '../../index.js';

describe('getTimeframes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no timeframes', () => {
    const timeframeGroupId = 'not_real';

    const results = getTimeframes({
      timeframe_group_id: timeframeGroupId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
