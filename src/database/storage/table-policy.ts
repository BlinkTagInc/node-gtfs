import type { GtfsDatabase } from '../../schema/database.ts';
import type { GtfsKeyStrategy } from '../../schema/define-table.ts';

export interface GtfsTableStoragePolicy {
  readonly keyStrategy: GtfsKeyStrategy;
  readonly storageKey?: readonly ['source_id', ...string[]] | null;
  readonly indexes?: readonly (string | readonly string[])[];
}

/** Physical tuning for managed tables; GTFS meaning lives in schema/tables. */
export const tableStoragePolicies = {
  agency: {
    keyStrategy: 'canonical',
  },
  alert_entity_selectors: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'agency_id'],
      ['source_id', 'route_id'],
      ['source_id', 'stop_id'],
      ['source_id', 'trip_id'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  alert_time_ranges: {
    keyStrategy: 'columns',
    indexes: [
      [
        'source_id',
        'realtime_feed_id',
        'alert_id',
        'range_kind',
        'start_unix_seconds',
        'end_unix_seconds',
      ],
      ['source_id', 'range_kind', 'start_unix_seconds', 'end_unix_seconds'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  alerts: {
    keyStrategy: 'columns',
    indexes: [['source_id', 'expires_at_unix_seconds']],
  },
  areas: {
    keyStrategy: 'columns',
  },
  attributions: {
    keyStrategy: 'canonical',
  },
  board_alight: {
    keyStrategy: 'none',
    storageKey: null,
    indexes: [
      'trip_id',
      'stop_id',
      'stop_sequence',
      'record_use',
      'service_date',
    ],
  },
  booking_rules: {
    keyStrategy: 'columns',
  },
  calendar: {
    keyStrategy: 'columns',
    indexes: ['start_date', 'end_date'],
  },
  calendar_attributes: {
    keyStrategy: 'columns',
  },
  calendar_dates: {
    keyStrategy: 'columns',
    indexes: [['date', 'exception_type', 'service_id']],
  },
  calendar_dates_supplement: {
    keyStrategy: 'columns',
  },
  calendar_supplement: {
    keyStrategy: 'columns',
  },
  deadhead_times: {
    keyStrategy: 'columns',
    indexes: ['location_sequence'],
  },
  deadheads: {
    keyStrategy: 'columns',
    indexes: [
      'block_id',
      'shape_id',
      'to_trip_id',
      'from_trip_id',
      'to_deadhead_id',
      'from_deadhead_id',
    ],
  },
  devices: {
    keyStrategy: 'columns',
  },
  directions: {
    keyStrategy: 'columns',
  },
  employee_run_dates: {
    keyStrategy: 'columns',
  },
  fare_attributes: {
    keyStrategy: 'columns',
  },
  fare_leg_join_rules: {
    keyStrategy: 'canonical',
  },
  fare_leg_rules: {
    keyStrategy: 'canonical',
  },
  fare_media: {
    keyStrategy: 'columns',
  },
  fare_products: {
    keyStrategy: 'canonical',
  },
  fare_rules: {
    keyStrategy: 'canonical',
    indexes: ['route_id'],
  },
  fare_transactions: {
    keyStrategy: 'columns',
    indexes: ['transaction_id'],
  },
  fare_transfer_rules: {
    keyStrategy: 'canonical',
  },
  feed_info: {
    keyStrategy: 'columns',
  },
  frequencies: {
    keyStrategy: 'columns',
  },
  levels: {
    keyStrategy: 'columns',
  },
  location_group_stops: {
    keyStrategy: 'columns',
    indexes: ['stop_id'],
  },
  location_groups: {
    keyStrategy: 'columns',
  },
  locations: {
    keyStrategy: 'columns',
  },
  networks: {
    keyStrategy: 'columns',
  },
  operators: {
    keyStrategy: 'columns',
  },
  ops_locations: {
    keyStrategy: 'columns',
  },
  passenger_events: {
    keyStrategy: 'columns',
    indexes: ['passenger_event_id'],
  },
  pathways: {
    keyStrategy: 'columns',
    indexes: ['from_stop_id', 'to_stop_id'],
  },
  realtime_feed_entities: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'realtime_feed_id', 'entity_type', 'entity_id'],
      ['source_id', 'entity_id'],
      ['source_id', 'retention_expires_at_unix_seconds'],
    ],
  },
  realtime_feeds: {
    keyStrategy: 'columns',
    indexes: [['source_id', 'feed_type']],
  },
  realtime_shapes: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'shape_id'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  realtime_snapshots: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'realtime_feed_id', 'fetched_at_unix_seconds'],
      ['source_id', 'feed_header_unix_seconds'],
      ['source_id', 'retention_expires_at_unix_seconds'],
      ['source_id', 'payload_sha256'],
    ],
  },
  realtime_stops: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'stop_id'],
      ['source_id', 'parent_station'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  ride_feed_info: {
    keyStrategy: 'columns',
    indexes: ['ride_start_date', 'ride_end_date', 'gtfs_feed_date'],
  },
  rider_categories: {
    keyStrategy: 'columns',
  },
  rider_trip: {
    keyStrategy: 'columns',
    indexes: [
      'agency_id',
      'trip_id',
      'boarding_stop_id',
      'boarding_stop_sequence',
      'alighting_stop_id',
      'alighting_stop_sequence',
      'service_date',
    ],
  },
  ridership: {
    keyStrategy: 'none',
    storageKey: null,
    indexes: [
      'ridership_start_date',
      'ridership_end_date',
      'service_id',
      'agency_id',
      'route_id',
      'direction_id',
    ],
  },
  route_attributes: {
    keyStrategy: 'columns',
  },
  route_networks: {
    keyStrategy: 'columns',
    indexes: ['network_id'],
  },
  routes: {
    keyStrategy: 'columns',
    indexes: ['agency_id'],
  },
  routes_supplement: {
    keyStrategy: 'columns',
  },
  run_event: {
    keyStrategy: 'columns',
    indexes: [
      'event_type',
      'event_from_location_type',
      'event_to_location_type',
    ],
  },
  run_events: {
    keyStrategy: 'columns',
    indexes: ['trip_id', 'block_id'],
  },
  runs_pieces: {
    keyStrategy: 'columns',
    indexes: ['start_type', 'start_trip_id', 'end_type', 'end_trip_id'],
  },
  shapes: {
    keyStrategy: 'columns',
  },
  station_activities: {
    keyStrategy: 'columns',
  },
  stop_areas: {
    keyStrategy: 'columns',
    indexes: ['stop_id'],
  },
  stop_attributes: {
    keyStrategy: 'columns',
  },
  stop_times: {
    keyStrategy: 'columns',
    indexes: [
      'location_group_id',
      'location_id',
      'pickup_booking_rule_id',
      'drop_off_booking_rule_id',
      ['stop_id', 'arrival_service_day_seconds'],
    ],
  },
  stop_times_supplement: {
    keyStrategy: 'columns',
  },
  stop_visits: {
    keyStrategy: 'columns',
  },
  stops: {
    keyStrategy: 'columns',
    indexes: [
      'stop_code',
      'parent_station',
      'level_id',
      ['source_id', 'stop_lat', 'stop_lon'],
    ],
  },
  stops_supplement: {
    keyStrategy: 'columns',
  },
  timeframes: {
    keyStrategy: 'canonical',
    indexes: ['service_id'],
  },
  timetable_notes: {
    keyStrategy: 'canonical',
  },
  timetable_notes_references: {
    keyStrategy: 'canonical',
  },
  timetable_pages: {
    keyStrategy: 'columns',
  },
  timetable_stop_order: {
    keyStrategy: 'columns',
    indexes: ['stop_sequence'],
  },
  timetables: {
    keyStrategy: 'columns',
    indexes: ['timetable_sequence'],
  },
  tods_vehicles: {
    keyStrategy: 'columns',
  },
  train_cars: {
    keyStrategy: 'columns',
  },
  transfers: {
    keyStrategy: 'canonical',
    indexes: ['to_stop_id'],
  },
  translations: {
    keyStrategy: 'canonical',
  },
  trip_capacity: {
    keyStrategy: 'none',
    storageKey: null,
    indexes: ['agency_id', 'trip_id', 'service_date'],
  },
  trip_modifications: {
    keyStrategy: 'columns',
    indexes: [['source_id', 'expires_at_unix_seconds']],
  },
  trip_update_stop_time_updates: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'trip_id'],
      ['source_id', 'route_id'],
      ['source_id', 'stop_id'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  trip_updates: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'vehicle_id'],
      ['source_id', 'trip_id'],
      ['source_id', 'route_id'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  trips: {
    keyStrategy: 'columns',
    indexes: [
      'service_id',
      'block_id',
      'shape_id',
      ['route_id', 'service_id', 'trip_id'],
    ],
  },
  trips_performed: {
    keyStrategy: 'columns',
  },
  trips_supplement: {
    keyStrategy: 'columns',
  },
  vehicle_assignments: {
    keyStrategy: 'canonical',
  },
  vehicle_locations: {
    keyStrategy: 'columns',
  },
  vehicle_positions: {
    keyStrategy: 'columns',
    indexes: [
      ['source_id', 'trip_id'],
      ['source_id', 'route_id'],
      ['source_id', 'stop_id'],
      ['source_id', 'vehicle_id'],
      ['source_id', 'trip_start_date', 'trip_start_time'],
      ['source_id', 'expires_at_unix_seconds'],
    ],
  },
  vehicle_train_cars: {
    keyStrategy: 'columns',
  },
  vehicles: {
    keyStrategy: 'columns',
  },
} as const satisfies Readonly<
  Record<keyof GtfsDatabase, GtfsTableStoragePolicy>
>;
