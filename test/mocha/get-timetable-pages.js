/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getTimetablePages,
} from '../../index.js';

describe('getTimetablePages():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no timetable pages (GTFS-to-HTML timetables)', async () => {
    const timetablePageId = 'fake-timetable-page-id';

    const results = await getTimetablePages({
      timetable_page_id: timetablePageId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
