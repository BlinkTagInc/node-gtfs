/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTimetablePages } from '../../index.js';

describe('getTimetablePages():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no timetable pages (GTFS-to-HTML timetables)', () => {
    const timetablePageId = 'fake-timetable-page-id';

    const results = getTimetablePages({
      timetable_page_id: timetablePageId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
