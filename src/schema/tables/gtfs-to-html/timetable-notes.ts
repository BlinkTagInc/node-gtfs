import { defineGtfsTable } from '../../define-table.ts';

export const timetableNotes = defineGtfsTable({
  file: 'timetable_notes.txt',
  presence: 'optional',
  primaryKey: [
    'note_id',
    'scope',
    'timetable_id',
    'route_id',
    'trip_id',
    'stop_id',
    'stop_sequence',
  ],
  fields: {
    note_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    symbol: { kind: 'text' },
    note: { kind: 'text', caseInsensitiveComparison: true },
    scope: { kind: 'text' },
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
  },
  namespace: 'gtfs-to-html',
});
