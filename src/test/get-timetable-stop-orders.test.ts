import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetableStopOrders,
} from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTimetableStopOrders():', () => {
  it('should return empty array if no timetable stop orders (GTFS-to-HTML timetables)', () => {
    const timetableId = 'fake-timetable-id';

    const results = getTimetableStopOrders({
      timetable_id: timetableId,
    });

    expect(results).toHaveLength(0);
  });
});
