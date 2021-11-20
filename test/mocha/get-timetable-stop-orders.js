/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getTimetableStopOrders,
} from '../../index.js';

describe('getTimetableStopOrders():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no timetable stop orders (GTFS-to-HTML timetables)', async () => {
    const timetableId = 'fake-timetable-id';

    const results = await getTimetableStopOrders({
      timetable_id: timetableId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
