import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timetableNotesReferences = defineGtfsDomainTable({
  filename: 'timetable_notes_references.txt',
  tableName: 'timetable_notes_references',
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
      references: [
        { targetFilename: 'timetable_notes.txt', targetField: 'note_id' },
      ],
    },
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
    show_on_stoptime: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  specification: 'gtfs-to-html',
});
