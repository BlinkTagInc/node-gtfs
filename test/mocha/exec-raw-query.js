/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  execRawQuery,
  runRawQuery,
} from '../../index.js';

describe('execRawQuery():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should DELETE a trip', async () => {
    const results = await runRawQuery('SELECT count(*) FROM trips');

    should.exists(results);
    results[0]['count(*)'].should.equal(218);

    await execRawQuery('DELETE FROM trips where trip_id = "329"');

    const newResults = await runRawQuery('SELECT count(*) FROM trips');

    should.exists(newResults);
    newResults[0]['count(*)'].should.equal(217);
  });
});
