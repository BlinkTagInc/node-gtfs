/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFeedInfo } from '../../index.js';

describe('getFeedInfo():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no feed info', () => {
    const feedPublisherName = 'not_real';

    const results = getFeedInfo({
      feed_publisher_name: feedPublisherName,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
