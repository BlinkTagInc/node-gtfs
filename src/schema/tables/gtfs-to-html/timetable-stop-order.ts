import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timetableStopOrder = defineGtfsDomainTable({
  filename: 'timetable_stop_order.txt',
  tableName: 'timetable_stop_order',
  presence: 'optional',
  primaryKey: ['timetable_id', 'stop_id', 'stop_sequence'],
  fields: {
    timetable_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'timetables.txt', targetField: 'timetable_id' },
      ],
    },
    stop_id: {
      kind: 'id',
      presence: 'required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    stop_sequence: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  specification: 'gtfs-to-html',
});
