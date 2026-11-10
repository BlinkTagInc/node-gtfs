import { defineGtfsDomainTable } from '../../domain-table.ts';

export const runEvents = defineGtfsDomainTable({
  filename: 'run_events.txt',
  tableName: 'run_events',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['service_id', 'run_id', 'event_sequence'],
  fields: {
    service_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
        { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
        {
          targetFilename: 'calendar_supplement.txt',
          targetField: 'service_id',
        },
        {
          targetFilename: 'calendar_dates_supplement.txt',
          targetField: 'service_id',
        },
      ],
    },
    run_id: { kind: 'id', presence: 'required' },
    event_sequence: { kind: 'integer', presence: 'required', minimum: 0 },
    piece_id: { kind: 'id' },
    block_id: {
      kind: 'id',
      references: [
        { targetFilename: 'trips.txt', targetField: 'block_id' },
        { targetFilename: 'trips_supplement.txt', targetField: 'block_id' },
      ],
    },
    job_type: { kind: 'text' },
    event_type: { kind: 'text', presence: 'required' },
    trip_id: {
      kind: 'id',
      references: [
        { targetFilename: 'trips.txt', targetField: 'trip_id' },
        { targetFilename: 'trips_supplement.txt', targetField: 'trip_id' },
      ],
    },
    start_location: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'stops.txt', targetField: 'stop_id' },
        { targetFilename: 'stops_supplement.txt', targetField: 'stop_id' },
      ],
    },
    start_time: { kind: 'time', presence: 'required' },
    start_mid_trip: { kind: 'enumeration', values: [0, 1, 2], closed: true },
    end_location: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'stops.txt', targetField: 'stop_id' },
        { targetFilename: 'stops_supplement.txt', targetField: 'stop_id' },
      ],
    },
    end_time: { kind: 'time', presence: 'required' },
    end_mid_trip: { kind: 'enumeration', values: [0, 1, 2], closed: true },
  },
  constraints: [
    {
      kind: 'range',
      startField: 'start_time',
      endField: 'end_time',
      allowEqual: true,
    },
  ],
});
