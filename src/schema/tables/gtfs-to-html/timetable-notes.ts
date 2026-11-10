import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timetableNotes = defineGtfsDomainTable({
  filename: 'timetable_notes.txt',
  tableName: 'timetable_notes',
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
    note_id: { kind: 'id', presence: 'required' },
    symbol: { kind: 'text' },
    note: { kind: 'text', supportsCaseInsensitiveComparison: true },
    scope: { kind: 'text' },
    timetable_id: {
      kind: 'id',
      references: [
        { targetFilename: 'timetables.txt', targetField: 'timetable_id' },
      ],
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    stop_sequence: { kind: 'integer', minimum: 0 },
  },
  specification: 'gtfs-to-html',
});
