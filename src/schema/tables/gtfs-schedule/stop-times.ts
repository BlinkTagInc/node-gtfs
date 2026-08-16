import { defineGtfsTable } from '../../define-table.ts';

export const stopTimes = defineGtfsTable({
  file: 'stop_times.txt',
  namespace: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['trip_id', 'stop_sequence'],
  fields: {
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    arrival_time: { kind: 'time' },
    departure_time: { kind: 'time' },
    location_group_id: {
      kind: 'id',
      references: [{ file: 'location_groups.txt', field: 'location_group_id' }],
      applyFeedPrefix: true,
    },
    location_id: {
      kind: 'id',
      references: [{ file: 'locations.geojson', field: 'id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    stop_sequence: { kind: 'integer', presence: 'required', minimum: 0 },
    stop_headsign: { kind: 'text', caseInsensitiveComparison: true },
    start_pickup_drop_off_window: { kind: 'time' },
    end_pickup_drop_off_window: { kind: 'time' },
    pickup_type: { kind: 'integer', minimum: 0, maximum: 3 },
    drop_off_type: { kind: 'integer', minimum: 0, maximum: 3 },
    continuous_pickup: { kind: 'integer', minimum: 0, maximum: 3 },
    continuous_drop_off: { kind: 'integer', minimum: 0, maximum: 3 },
    shape_dist_traveled: { kind: 'real', minimum: 0 },
    timepoint: { kind: 'integer', minimum: 0, maximum: 1 },
    pickup_booking_rule_id: {
      kind: 'id',
      references: [{ file: 'booking_rules.txt', field: 'booking_rule_id' }],
      applyFeedPrefix: true,
    },
    drop_off_booking_rule_id: {
      kind: 'id',
      references: [{ file: 'booking_rules.txt', field: 'booking_rule_id' }],
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: [
      'arrival_timestamp',
      'departure_timestamp',
      'location_group_id',
      'location_id',
      'stop_id',
      'start_pickup_drop_off_window_timestamp',
      'end_pickup_drop_off_window_timestamp',
      'pickup_booking_rule_id',
      'drop_off_booking_rule_id',
      ['stop_id', 'trip_id', 'stop_sequence'],
    ],
  },
});
