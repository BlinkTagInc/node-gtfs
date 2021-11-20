/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getTimetables,
} from '../../index.js';

describe('getTimetables():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no timetables (GTFS-to-HTML timetables)', async () => {
    const timetableId = 'fake-timetable-id';

    const results = await getTimetables({
      timetable_id: timetableId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
