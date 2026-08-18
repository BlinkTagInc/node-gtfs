import { defineGtfsTable } from '../../define-table.ts';

export const stationActivities = defineGtfsTable({
  file: 'station_activities.csv',
  presence: 'optional',
  primaryKey: [
    'service_date',
    'stop_id',
    'time_period_start',
    'time_period_end',
  ],
  fields: {
    service_date: { kind: 'date', presence: 'required' },
    stop_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    time_period_start: { kind: 'text', presence: 'required' },
    time_period_end: { kind: 'text', presence: 'required' },
    time_period_category: { kind: 'text' },
    total_entries: { kind: 'integer', minimum: 0 },
    total_exits: { kind: 'integer', minimum: 0 },
    number_of_transactions: { kind: 'integer', minimum: 0 },
    bike_entries: { kind: 'integer', minimum: 0 },
    bike_exits: { kind: 'integer', minimum: 0 },
    ramp_entries: { kind: 'integer', minimum: 0 },
    ramp_exits: { kind: 'integer', minimum: 0 },
  },
  namespace: 'tides',
});
