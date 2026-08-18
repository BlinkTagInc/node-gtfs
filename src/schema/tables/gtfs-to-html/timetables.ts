import { defineGtfsTable } from '../../define-table.ts';

export const timetables = defineGtfsTable({
  file: 'timetables.txt',
  presence: 'optional',
  primaryKey: ['timetable_id', 'route_id'],
  fields: {
    timetable_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    route_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    start_date: { kind: 'date' },
    end_date: { kind: 'date' },
    monday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    tuesday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    wednesday: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    thursday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    friday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    saturday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    sunday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    start_time: { kind: 'time' },
    end_time: { kind: 'time' },
    timetable_label: { kind: 'text', caseInsensitiveComparison: true },
    service_notes: { kind: 'text', caseInsensitiveComparison: true },
    orientation: { kind: 'text' },
    timetable_page_id: {
      kind: 'id',
      references: [{ file: 'timetable_pages.txt', field: 'timetable_page_id' }],
      applyFeedPrefix: true,
    },
    timetable_sequence: { kind: 'integer', minimum: 0 },
    direction_name: { kind: 'text' },
    include_exceptions: { kind: 'integer', minimum: 0, maximum: 1 },
    show_trip_continuation: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  storage: {
    indexes: ['timetable_sequence'],
  },
  namespace: 'gtfs-to-html',
});
