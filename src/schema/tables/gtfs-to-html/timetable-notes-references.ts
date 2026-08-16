import { defineGtfsTable } from '../../define-table.ts';

export const timetableNotesReferences = defineGtfsTable({
  file: 'timetable_notes_references.txt',
  presence: 'optional',
  primaryKey: [
    'note_id',
    'timetable_id',
    'route_id',
    'trip_id',
    'stop_id',
    'stop_sequence',
  ],
  fields: {
    note_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'timetable_notes.txt', field: 'note_id' }],
      applyFeedPrefix: true,
    },
    timetable_id: {
      kind: 'id',
      references: [{ file: 'timetables.txt', field: 'timetable_id' }],
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    stop_sequence: { kind: 'integer', minimum: 0 },
    show_on_stoptime: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  namespace: 'gtfs-to-html',
});
