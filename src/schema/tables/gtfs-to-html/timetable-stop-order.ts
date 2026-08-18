import { defineGtfsTable } from '../../define-table.ts';

export const timetableStopOrder = defineGtfsTable({
  file: 'timetable_stop_order.txt',
  presence: 'optional',
  primaryKey: ['timetable_id', 'stop_id', 'stop_sequence'],
  fields: {
    timetable_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'timetables.txt', field: 'timetable_id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    stop_sequence: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  storage: {
    indexes: ['stop_sequence'],
  },
  namespace: 'gtfs-to-html',
});
