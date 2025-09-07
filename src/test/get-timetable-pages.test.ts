import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetablePages,
} from '../../dist/index.js';

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
