/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getFeedInfo,
} from '../../index.js';

describe('getFeedInfo():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no feed info', async () => {
    const feedPublisherName = 'not_real';

    const results = await getFeedInfo({
      feed_publisher_name: feedPublisherName,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
