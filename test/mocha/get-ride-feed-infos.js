/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getRideFeedInfos } from '../../index.js';

describe('getRideFeedInfos():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no ride-feed-infos (GTFS-ride)', () => {
    const results = getRideFeedInfos({});
    should.exists(results);
    results.should.have.length(0);
  });
});
