/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getFareMedia } from '../../index.js';

describe('getFareMedia():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no fare_media exist', () => {
    const fareMediaId = 'fake-fare-media-id';
    const results = getFareMedia({
      fare_media_id: fareMediaId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
