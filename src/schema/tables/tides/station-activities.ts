import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stationActivities = defineGtfsDomainTable({
  filename: 'station_activities.csv',
  tableName: 'station_activities',
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
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
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
  specification: 'tides',
});
