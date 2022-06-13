/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  runRawQuery,
} from '../../index.js';

describe('runRawQuery():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no trips', async () => {
    const results = await runRawQuery(
      'SELECT * FROM trips WHERE trip_id = "fake-trip-id"'
    );

    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected results', async () => {
    const results = await runRawQuery(
      'SELECT "trip_id", "arrival_time" FROM stop_times WHERE trip_id = "329"'
    );

    const expectedResults = [
      { trip_id: '329', arrival_time: '9:09:00' },
      { trip_id: '329', arrival_time: '8:52:00' },
      { trip_id: '329', arrival_time: '8:44:00' },
      { trip_id: '329', arrival_time: '8:35:00' },
      { trip_id: '329', arrival_time: '8:27:00' },
      { trip_id: '329', arrival_time: '8:16:00' },
      { trip_id: '329', arrival_time: '8:03:00' },
      { trip_id: '329', arrival_time: '7:56:00' },
    ];

    should.exist(results);
    results.length.should.equal(8);
    expectedResults.should.match(results);
  });
});
