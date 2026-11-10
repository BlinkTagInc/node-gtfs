import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timetables = defineGtfsDomainTable({
  filename: 'timetables.txt',
  tableName: 'timetables',
  presence: 'optional',
  primaryKey: ['timetable_id', 'route_id'],
  fields: {
    timetable_id: { kind: 'id', presence: 'required' },
    route_id: {
      kind: 'id',
      presence: 'required',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
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
    timetable_label: { kind: 'text', supportsCaseInsensitiveComparison: true },
    service_notes: { kind: 'text', supportsCaseInsensitiveComparison: true },
    orientation: { kind: 'text' },
    timetable_page_id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'timetable_pages.txt',
          targetField: 'timetable_page_id',
        },
      ],
    },
    timetable_sequence: { kind: 'integer', minimum: 0 },
    direction_name: { kind: 'text' },
    include_exceptions: { kind: 'integer', minimum: 0, maximum: 1 },
    show_trip_continuation: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  specification: 'gtfs-to-html',
});
