import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetables,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTimetables():', () => {
  it('should return empty array if no timetables (GTFS-to-HTML timetables)', () => {
    const timetableId = 'fake-timetable-id';

    const results = getTimetables({
      timetable_id: timetableId,
    });

    expect(results).toHaveLength(0);
  });
});
