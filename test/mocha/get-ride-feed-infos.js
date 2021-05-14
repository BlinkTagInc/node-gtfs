/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getRideFeedInfos } from '../../index.js';

describe('getRideFeedInfos():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no ride-feed-infos (GTFS-ride)', async () => {
    const results = await getRideFeedInfos({});
    should.exists(results);
    results.should.have.length(0);
  });
});
