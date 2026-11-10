import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stopTimes = defineGtfsDomainTable({
  filename: 'stop_times.txt',
  tableName: 'stop_times',
  specification: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['trip_id', 'stop_sequence'],
  fields: {
    trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
      presence: 'required',
    },
    arrival_time: { kind: 'time', presence: 'conditionally-required' },
    departure_time: { kind: 'time', presence: 'conditionally-required' },
    location_group_id: {
      kind: 'id',
      presence: 'conditionally-forbidden',
      references: [
        {
          targetFilename: 'location_groups.txt',
          targetField: 'location_group_id',
        },
      ],
    },
    location_id: {
      kind: 'id',
      presence: 'conditionally-forbidden',
      references: [{ targetFilename: 'locations.geojson', targetField: 'id' }],
    },
    stop_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    stop_sequence: { kind: 'integer', presence: 'required', minimum: 0 },
    stop_headsign: { kind: 'text', supportsCaseInsensitiveComparison: true },
    start_pickup_drop_off_window: {
      kind: 'time',
      presence: 'conditionally-required',
    },
    end_pickup_drop_off_window: {
      kind: 'time',
      presence: 'conditionally-required',
    },
    pickup_type: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    drop_off_type: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    continuous_pickup: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    continuous_drop_off: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    shape_dist_traveled: { kind: 'real', minimum: 0 },
    timepoint: { kind: 'integer', minimum: 0, maximum: 1 },
    pickup_booking_rule_id: {
      kind: 'id',
      references: [
        { targetFilename: 'booking_rules.txt', targetField: 'booking_rule_id' },
      ],
    },
    drop_off_booking_rule_id: {
      kind: 'id',
      references: [
        { targetFilename: 'booking_rules.txt', targetField: 'booking_rule_id' },
      ],
    },
  },
});
