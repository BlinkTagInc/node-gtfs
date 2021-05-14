/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getTimetables } from '../../index.js';

describe('getTimetables():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no timetables (GTFS-to-HTML timetables)', async () => {
    const timetableId = 'fake-timetable-id';

    const results = await getTimetables({
      timetable_id: timetableId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
