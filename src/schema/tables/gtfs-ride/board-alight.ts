import { defineGtfsTable } from '../../define-table.ts';

export const boardAlight = defineGtfsTable({
  file: 'board_alight.txt',
  presence: 'optional',
  fields: {
    trip_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    stop_sequence: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    record_use: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    schedule_relationship: { kind: 'integer', minimum: 0, maximum: 8 },
    boardings: { kind: 'integer', minimum: 0 },
    alightings: { kind: 'integer', minimum: 0 },
    current_load: { kind: 'integer', minimum: 0 },
    load_count: { kind: 'integer', minimum: 0 },
    load_type: { kind: 'integer', minimum: 0, maximum: 1 },
    rack_down: { kind: 'integer', minimum: 0, maximum: 1 },
    bike_boardings: { kind: 'integer', minimum: 0 },
    bike_alightings: { kind: 'integer', minimum: 0 },
    ramp_used: { kind: 'integer', minimum: 0, maximum: 1 },
    ramp_boardings: { kind: 'integer', minimum: 0 },
    ramp_alightings: { kind: 'integer', minimum: 0 },
    service_date: { kind: 'date' },
    service_arrival_time: { kind: 'time' },
    service_departure_time: { kind: 'time' },
    source: { kind: 'integer', minimum: 0, maximum: 4 },
  },
  storage: {
    indexes: [
      'trip_id',
      'stop_id',
      'stop_sequence',
      'record_use',
      'service_date',
      'service_arrival_timestamp',
      'service_departure_timestamp',
    ],
  },
  namespace: 'gtfs-ride',
});
