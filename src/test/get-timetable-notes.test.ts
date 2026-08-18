import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetableNotes,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTimetableNotes():', () => {
  it('should return empty array if no timetable notes (GTFS-to-HTML timetables)', () => {
    const noteId = 'fake-note-id';

    const results = getTimetableNotes({
      note_id: noteId,
    });

    expect(results).toHaveLength(0);
  });
});
