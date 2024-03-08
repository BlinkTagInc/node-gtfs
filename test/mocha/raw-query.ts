/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs } from '../../index.js';

describe('Raw Query:', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should DELETE a trip', () => {
    const db = openDb(config);

    const results = db.prepare('SELECT count(*) FROM trips').get();

    should.exists(results);
    results['count(*)'].should.equal(218);

    db.exec("DELETE FROM trips where trip_id = '329';");

    const newResults = db.prepare('SELECT count(*) FROM trips').get();

    should.exists(newResults);
    newResults['count(*)'].should.equal(217);
  });
});
