/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetableStopOrders,
} from '../../index.js';

describe('getTimetableStopOrders():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no timetable stop orders (GTFS-to-HTML timetables)', () => {
    const timetableId = 'fake-timetable-id';

    const results = getTimetableStopOrders({
      timetable_id: timetableId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
