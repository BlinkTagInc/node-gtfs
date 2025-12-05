import type { Options } from 'csv-parse';
import type { Database } from 'better-sqlite3';

export type UnixTimestamp = number;

export type TableNames =
  | 'agency'
  | 'stops'
  | 'routes'
  | 'trips'
  | 'stop_times'
  | 'calendar'
  | 'calendar_dates'
  | 'fare_attributes'
  | 'fare_rules'
  | 'timeframes'
  | 'rider_categories'
  | 'fare_media'
  | 'fare_products'
  | 'fare_leg_rules'
  | 'fare_leg_join_rules'
  | 'fare_transfer_rules'
  | 'areas'
  | 'stop_areas'
  | 'networks'
  | 'route_networks'
  | 'shapes'
  | 'frequencies'
  | 'transfers'
  | 'pathways'
  | 'levels'
  | 'location_groups'
  | 'location_group_stops'
  | 'locations'
  | 'booking_rules'
  | 'translations'
  | 'feed_info'
  | 'attributions';

interface BaseConfigAgency {
  /**
   * An array of GTFS file names (without .txt) to exclude when importing
   */
  exclude?: TableNames[];
  /**
   * An object of HTTP headers in key:value format to use when fetching GTFS from the url specified
   */
  headers?: Record<string, string>;
  /**
   * Settings for fetching GTFS-Realtime alerts
   */
  realtimeAlerts?: {
    /**
     * URL for fetching GTFS-Realtime alerts
     */
    url: string;
    /**
     * Headers to use when fetching GTFS-Realtime alerts
     */
    headers?: Record<string, string>;
  };
  /**
   * Settings for fetching GTFS-Realtime trip updates
   */
  realtimeTripUpdates?: {
    /**
     * URL for fetching GTFS-Realtime trip updates
     */
    url: string;
    /**
     * Headers to use when fetching GTFS-Realtime trip updates
     */
    headers?: Record<string, string>;
  };
  /**
   * Settings for fetching GTFS-Realtime vehicle positions
   */
  realtimeVehiclePositions?: {
    /**
     * URL for fetching GTFS-Realtime vehicle positions
     */
    url: string;
    /**
     * Headers to use when fetching GTFS-Realtime vehicle positions
     */
    headers?: Record<string, string>;
  };
  /**
   * A prefix to be added to every ID field maintain uniqueness when importing multiple GTFS from multiple agencies
   */
  prefix?: string;
}

export type ConfigAgency = BaseConfigAgency &
  (
    | {
        /**
         * The URL to a zipped GTFS file. Required if path not present
         */
        url: string;
      }
    | {
        /**
         * A path to a zipped GTFS file or a directory of unzipped .txt files. Required if url is not present
         */
        path: string;
      }
  );

export interface Config {
  /**
   * An existing database instance to use instead of relying on node-gtfs to connect.
   */
  db?: Database;
  /**
   * A path to an SQLite database. Defaults to using an in-memory database.
   */
  sqlitePath?: string;
  /**
   * Amount of time in seconds to allow GTFS-Realtime data to be stored in database before allowing to be deleted.
   *
   * Note: is an integer
   *
   * @defaultValue 0
   */
  gtfsRealtimeExpirationSeconds?: number;
  /**
   * The number of milliseconds to wait before throwing an error when downloading GTFS.
   *
   * Note: is an integer
   */
  downloadTimeout?: number;
  /**
   * Options passed to `csv-parse` for parsing GTFS CSV files.
   */
  csvOptions?: Options;
  /**
   * A path to a directory to put exported GTFS files.
   *
   * @defaultValue `gtfs-export/<agency_name>`
   */
  exportPath?: string;
  /**
   * Whether or not to ignore unique constraints on ids when importing GTFS, such as `trip_id`, `calendar_id`.
   *
   * @defaultValue false
   */
  ignoreDuplicates?: boolean;
  /**
   * Whether or not to ignore errors during the import process. If true, failed files will be skipped while the rest are processed.
   *
   * @defaultValue false
   */
  ignoreErrors?: boolean;
  /**
   * An array of GTFS files to be imported, and which files to exclude.
   */
  agencies: ConfigAgency[];
  /**
   * Whether or not to print output to the console.
   *
   * @defaulValue true
   */
  verbose?: boolean;
  /**
   * An optional custom logger instead of the build in console.log
   *
   * @param message
   * @returns
   */
  logFunction?: (message: string) => void;
}

export interface ModelColumn {
  name: string;
  type: 'text' | 'integer' | 'real' | 'json' | 'date' | 'time';
  min?: number;
  max?: number;
  required?: boolean;
  primary?: boolean;
  index?: boolean;
  default?: string | number | null;
  nocase?: boolean;
  source?: string;
  prefix?: boolean;
}

export interface Model {
  filenameBase: TableNames;
  filenameExtension?: string;
  extension?: string;
  nonstandard?: boolean;
  schema: ModelColumn[];
}

export interface JoinOptions {
  type?: string;
  table: string;
  on: string;
}

export type SqlValue =
  | undefined
  | null
  | string
  | number
  | boolean
  | Date
  | SqlValue[];

export type SqlWhere = Record<string, null | SqlValue | SqlValue[]>;

export type QueryResult<Base extends object, Select extends keyof Base> = [
  Select,
] extends [never]
  ? Base
  : Pick<Base, Select>;

export type SqlOrderBy = Array<[string, 'ASC' | 'DESC']>;

export interface QueryOptions {
  db?: Database;
  bounding_box_side_m?: number;
}

export interface Agency {
  agency_id: string | null;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string | null;
  agency_phone: string | null;
  agency_fare_url: string | null;
  agency_email: string | null;
  cemv_support: 0 | 1 | 2 | null;
}

export interface Area {
  area_id: string;
  area_name: string | null;
}

export interface Attribution {
  attribution_id: string | null;
  agency_id: string | null;
  route_id: string | null;
  trip_id: string | null;
  organization_name: string;
  is_producer: 0 | 1 | null;
  is_operator: 0 | 1 | null;
  is_authority: 0 | 1 | null;
  attribution_url: string | null;
  attribution_email: string | null;
  attribution_phone: string | null;
}

export interface BookingRule {
  booking_rule_id: string;
  booking_type: 0 | 1 | 2;
  prior_notice_duration_min: number | null;
  prior_notice_duration_max: number | null;
  prior_notice_last_day: number | null;
  prior_notice_last_time: string | null;
  prior_notice_last_timestamp: UnixTimestamp | null;
  prior_notice_start_day: number | null;
  prior_notice_start_time: string | null;
  prior_notice_start_timestamp: UnixTimestamp | null;
  prior_notice_service_id: string | null;
  message: string | null;
  pickup_message: string | null;
  drop_off_message: string | null;
  phone_number: string | null;
  info_url: string | null;
  booking_url: string | null;
}

export interface Calendar {
  service_id: string;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  start_date: number;
  end_date: number;
}

export interface CalendarDate {
  service_id: string;
  date: number;
  exception_type: 1 | 2;
  holiday_name: string | null;
}

export interface FareAttribute {
  fare_id: string;
  price: number;
  currency_type: string;
  payment_method: 0 | 1;
  transfers: 0 | 1 | 2;
  agency_id: string | null;
  transfer_duration: number | null;
}

export interface FareLegRule {
  leg_group_id: string | null;
  network_id: string | null;
  from_area_id: string | null;
  to_area_id: string | null;
  from_timeframe_group_id: string | null;
  to_timeframe_group_id: string | null;
  fare_product_id: string;
  rule_priority: number | null;
}

export interface FareMedia {
  fare_media_id: string;
  fare_media_name: string | null;
  fare_media_type: 0 | 1 | 2 | 3 | 4;
}

export interface FareProduct {
  fare_product_id: string;
  fare_product_name: string | null;
  fare_media_id: string | null;
  amount: number;
  currency: string;
}

export interface FareRule {
  fare_id: string;
  route_id: string | null;
  origin_id: string | null;
  destination_id: string | null;
  contains_id: string | null;
}

export interface FareTransferRule {
  from_leg_group_id: string | null;
  to_leg_group_id: string | null;
  transfer_count: number | null;
  duration_limit: number;
  duration_limit_type: 0 | 1 | 2 | 3 | null;
  fare_transfer_type: 0 | 1 | 2;
  fare_product_id: string | null;
}

export interface FeedInfo {
  feed_publisher_name: string;
  feed_publisher_url: string;
  feed_lang: string;
  default_lang: string | null;
  feed_start_date: number | null;
  feed_end_date: number | null;
  feed_version: string | null;
  feed_contact_email: string | null;
  feed_contact_url: string | null;
}

export interface Frequency {
  trip_id: string;
  start_time: string;
  start_timestamp: UnixTimestamp;
  end_time: string;
  end_timestamp: UnixTimestamp;
  headway_secs: number;
  exact_times: 0 | 1 | null;
}

export interface Level {
  level_id: string;
  level_index: number;
  level_name: string | null;
}

export interface LocationGroupStop {
  location_group_id: string;
  stop_id: string;
}

export interface LocationGroup {
  location_group_id: string;
  location_group_name: string | null;
}

export interface Location {
  geojson: string;
}

export interface Network {
  network_id: string;
  network_name: string | null;
}

export interface Pathway {
  pathway_id: string;
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  is_bidirectional: 0 | 1;
  length: number | null;
  traversal_time: number | null;
  stair_count: number | null;
  max_slope: number | null;
  min_width: number | null;
  signposted_as: string | null;
  reversed_signposted_as: string | null;
}

export interface RouteNetwork {
  network_id: string;
  route_id: string;
}

export interface Route {
  route_id: string;
  agency_id: string | null;
  route_short_name: string | null;
  route_long_name: string | null;
  route_desc: string | null;
  route_type: number;
  route_url: string | null;
  route_color: string | null;
  route_text_color: string | null;
  route_sort_order: number | null;
  continuous_pickup: 0 | 1 | 2 | 3 | null;
  continuous_drop_off: 0 | 1 | 2 | 3 | null;
  network_id: string | null;
  cemv_support: 0 | 1 | 2 | null;
}

export interface Shape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled: number | null;
}

export interface StopArea {
  area_id: string;
  stop_id: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string | null;
  arrival_timestamp: UnixTimestamp | null;
  departure_time: string | null;
  departure_timestamp: UnixTimestamp | null;
  location_group_id: string | null;
  location_id: string | null;
  stop_id: string | null;
  stop_sequence: number;
  stop_headsign: string | null;
  start_pickup_drop_off_window: string | null;
  start_pickup_drop_off_window_timestamp: UnixTimestamp | null;
  pickup_type: 0 | 1 | 2 | 3 | null;
  drop_off_type: 0 | 1 | 2 | 3 | null;
  continuous_pickup: 0 | 1 | 2 | 3 | null;
  continuous_drop_off: 0 | 1 | 2 | 3 | null;
  shape_dist_traveled: number | null;
  timepoint: 0 | 1 | null;
  pickup_booking_rule_id: string | null;
  drop_off_booking_rule_id: string | null;
}

export interface Stop {
  stop_id: string;
  stop_code: string | null;
  stop_name: string | null;
  tts_stop_name: string | null;
  stop_desc: string | null;
  stop_lat: number | null;
  stop_lon: number | null;
  zone_id: string | null;
  stop_url: string | null;
  location_type: 0 | 1 | 2 | 3 | 4 | null;
  parent_station: string | null;
  stop_timezone: string | null;
  wheelchair_boarding: 0 | 1 | 2 | null;
  level_id: string | null;
  platform_code: string | null;
  stop_access: 0 | 1 | null;
}

export interface Timeframe {
  timeframe_group_id: string;
  start_time: string | null;
  end_time: string | null;
  service_id: string;
}

export interface Transfer {
  from_stop_id: string | null;
  to_stop_id: string | null;
  from_route_id: string | null;
  to_route_id: string | null;
  from_trip_id: string | null;
  to_trip_id: string | null;
  transfer_type: 0 | 1 | 2 | 3 | 4 | 5;
  min_transfer_time: number | null;
}

export interface Translation {
  table_name: string;
  field_name: string;
  language: string;
  translation: string;
  record_id: string | null;
  record_sub_id: string | null;
  field_value: string | null;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string | null;
  trip_short_name: string | null;
  direction_id: 0 | 1 | null;
  block_id: string | null;
  shape_id: string | null;
  wheelchair_accessible: 0 | 1 | 2 | null;
  bikes_allowed: 0 | 1 | 2 | null;
  cars_allowed: 0 | 1 | 2 | null;
}

export interface Timetable {
  timetable_id: string;
  route_id: string;
  direction_id: 0 | 1 | null;
  start_date: number | null;
  end_date: number | null;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  start_time: string | null;
  start_timestamp: UnixTimestamp | null;
  end_time: string | null;
  end_timestamp: UnixTimestamp | null;
  timetable_label: string | null;
  service_notes: string | null;
  orientation: string | null;
  timetable_page_id: string | null;
  timetable_sequence: number | null;
  direction_name: string | null;
  include_exceptions: 0 | 1 | null;
  show_trip_continuation: 0 | 1 | null;
}

export interface TimetablePage {
  timetable_page_id: string;
  timetable_page_label: string | null;
  filename: string | null;
}

export interface TimetableStopOrder {
  timetable_id: string;
  stop_id: string;
  stop_sequence: number;
}

export interface TimetableNote {
  note_id: string;
  symbol: string | null;
  note: string;
}

export interface TimetableNotesReference {
  note_id: string;
  timetable_id: string;
  route_id: string | null;
  trip_id: string | null;
  stop_id: string | null;
  stop_sequence: number | null;
  show_on_stoptime: 0 | 1 | null;
}

export interface TripsDatedVehicleJourney {
  trip_id: string;
  operating_day_date: string;
  dated_vehicle_journey_gid: string;
  journey_number: number;
}

export interface DeadheadTime {
  deadhead_id: string;
  arrival_time: string;
  arrival_timestamp: UnixTimestamp;
  departure_time: string;
  departure_timestamp: UnixTimestamp;
  ops_location_id: string | null;
  stop_id: string | null;
  location_sequence: number;
  shape_dist_traveled: number | null;
}

export interface Deadhead {
  deadhead_id: string;
  service_id: string;
  block_id: string;
  shape_id: string | null;
  to_trip_id: string | null;
  from_trip_id: string | null;
  to_deadhead_id: string | null;
  from_deadhead_id: string | null;
}

export interface OpsLocation {
  ops_location_id: string;
  ops_location_code: string | null;
  ops_location_name: string;
  ops_location_desc: string | null;
  ops_location_lat: number;
  ops_location_lon: number;
}

export interface RunEvent {
  run_event_id: string;
  piece_id: string;
  event_type: number;
  event_name: string | null;
  event_time: string;
  event_duration: number;
  event_from_location_type: 0 | 1;
  event_from_location_id: string | null;
  event_to_location_type: 0 | 1;
  event_to_location_id: string | null;
}

export interface RunPiece {
  run_id: string;
  piece_id: string;
  start_type: 0 | 1 | 2;
  start_trip_id: string;
  start_trip_position: number | null;
  end_type: 0 | 1 | 2;
  end_trip_id: string;
  end_trip_position: number | null;
}

export interface ServiceAlert {
  id: string;
  cause: string | null;
  effect: string | null;
  url: string | null;
  start_time: string;
  end_time: string;
  header_text: string;
  description_text: string;
  tts_header_text: string | null;
  tts_description_text: string | null;
  severity_level: string | null;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface StopTimeUpdate {
  trip_id: string | null;
  trip_start_time: string | null;
  direction_id: 0 | 1 | null;
  route_id: string | null;
  stop_id: string | null;
  stop_sequence: number | null;
  arrival_delay: number | null;
  departure_delay: number | null;
  departure_timestamp: UnixTimestamp | null;
  arrival_timestamp: UnixTimestamp | null;
  schedule_relationship: string | null;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface TripUpdate {
  id: string;
  vehicle_id: string | null;
  trip_id: string | null;
  trip_start_time: string | null;
  direction_id: 0 | 1 | null;
  route_id: string | null;
  start_date: number | null;
  timestamp: UnixTimestamp | null;
  schedule_relationship: string | null;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface VehiclePosition {
  id: string;
  bearing: number | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  current_stop_sequence: number | null;
  trip_id: string | null;
  trip_start_date: number | null;
  trip_start_time: string | null;
  congestion_level: string | null;
  occupancy_status: string | null;
  occupancy_percentage: number | null;
  vehicle_stop_status: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  vehicle_license_plate: string | null;
  vehicle_wheelchair_accessible: number | null;
  timestamp: UnixTimestamp | null;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface BoardAlight {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  record_use: 0 | 1;
  schedule_relationship: number | null;
  boardings: number | null;
  alightings: number | null;
  current_load: number | null;
  load_count: number | null;
  load_type: number | null;
  rack_down: number | null;
  bike_boardings: number | null;
  bike_alightings: number | null;
  ramp_used: number | null;
  ramp_boardings: number | null;
  ramp_alightings: number | null;
  service_date: number | null;
  service_arrival_time: string | null;
  service_arrival_timestamp: UnixTimestamp | null;
  service_departure_time: string | null;
  service_departure_timestamp: UnixTimestamp | null;
  source: 0 | 1 | 2 | 3 | 4 | null;
}

export interface RideFeedInfo {
  ride_files: number;
  ride_start_date: number | null;
  ride_end_date: number | null;
  gtfs_feed_date: number | null;
  default_currency_type: string | null;
  ride_feed_version: string | null;
}

export interface RiderCategory {
  rider_category_id: string;
  rider_category_name: string;
  is_default_fare_category: 0 | 1 | null;
  eligibility_url: string | null;
}

export interface RiderTrip {
  rider_id: string;
  agency_id: string | null;
  trip_id: string | null;
  boarding_stop_id: string | null;
  boarding_stop_sequence: number | null;
  alighting_stop_id: string | null;
  alighting_stop_sequence: number | null;
  service_date: number | null;
  boarding_time: string | null;
  boarding_timestamp: UnixTimestamp | null;
  alighting_time: string | null;
  alighting_timestamp: UnixTimestamp | null;
  rider_type: number | null;
  rider_type_description: string | null;
  fare_paid: number | null;
  transaction_type: number | null;
  fare_media: number | null;
  accompanying_device: number | null;
  transfer_status: number | null;
}

export interface Ridership {
  total_boardings: number;
  total_alightings: number;
  ridership_start_date: number | null;
  ridership_end_date: number | null;
  ridership_start_time: string | null;
  ridership_start_timestamp: UnixTimestamp | null;
  ridership_end_time: string | null;
  ridership_end_timestamp: UnixTimestamp | null;
  service_id: string | null;
  monday: 0 | 1 | null;
  tuesday: 0 | 1 | null;
  wednesday: 0 | 1 | null;
  thursday: 0 | 1 | null;
  friday: 0 | 1 | null;
  saturday: 0 | 1 | null;
  sunday: 0 | 1 | null;
  agency_id: string | null;
  route_id: string | null;
  direction_id: 0 | 1 | null;
  trip_id: string | null;
  stop_id: string | null;
}

export interface TripCapacity {
  agency_id: string | null;
  trip_id: string | null;
  service_date: number | null;
  vehicle_description: string | null;
  seated_capacity: number | null;
  standing_capacity: number | null;
  wheelchair_capacity: number | null;
  bike_capacity: number | null;
}

export interface CalendarAttribute {
  service_id: string;
  service_description: string;
}

export interface Direction {
  route_id: string;
  direction_id: 0 | 1 | null;
  direction: string;
}

export interface RouteAttribute {
  route_id: string;
  category: number;
  subcategory: number;
  running_way: number;
}

export interface StopAttribute {
  stop_id: string;
  accessibility_id: number | null;
  cardinal_direction: string | null;
  relative_position: string | null;
  stop_city: string | null;
}
