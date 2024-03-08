/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getStopAttributes } from '../../index.js';

describe('getStopAttributes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no stop attributes', () => {
    const stopId = 'fake-stop-id';

    const results = getStopAttributes({
      stop_id: stopId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
