import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTimetables } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
