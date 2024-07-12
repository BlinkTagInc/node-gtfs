import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTimetablePages } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTimetablePages():', () => {
  it('should return empty array if no timetable pages (GTFS-to-HTML timetables)', () => {
    const timetablePageId = 'fake-timetable-page-id';

    const results = getTimetablePages({
      timetable_page_id: timetablePageId,
    });

    expect(results).toHaveLength(0);
  });
});
