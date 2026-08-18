import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTimetableNotesReferences,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTimetableNotesReferences():', () => {
  it('should return empty array if no timetable notes references (GTFS-to-HTML timetables)', () => {
    const noteId = 'fake-note-id';

    const results = getTimetableNotesReferences({
      note_id: noteId,
    });

    expect(results).toHaveLength(0);
  });
});
