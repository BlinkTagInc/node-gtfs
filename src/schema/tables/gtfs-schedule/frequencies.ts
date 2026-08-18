import { defineGtfsTable } from '../../define-table.ts';

export const frequencies = defineGtfsTable({
  file: 'frequencies.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['trip_id', 'start_time'],
  fields: {
    trip_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    start_time: { kind: 'time', presence: 'required' },
    end_time: { kind: 'time', presence: 'required' },
    headway_secs: { kind: 'integer', presence: 'required', minimum: 1 },
    exact_times: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  constraints: [
    {
      kind: 'range',
      startField: 'start_time',
      endField: 'end_time',
      allowEqual: false,
    },
  ],
});
