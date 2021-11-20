/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getRideFeedInfos,
} from '../../index.js';

describe('getRideFeedInfos():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no ride-feed-infos (GTFS-ride)', async () => {
    const results = await getRideFeedInfos({});
    should.exists(results);
    results.should.have.length(0);
  });
});
