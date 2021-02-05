/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getTimetablePages():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no timetable pages', async () => {
    const timetablePageId = 'fake-timetable-page-id';

    const results = await gtfs.getTimetablePages({
      timetable_page_id: timetablePageId
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
