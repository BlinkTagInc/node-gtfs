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
  agency_id?: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang?: string;
  agency_phone?: string;
  agency_fare_url?: string;
  agency_email?: string;
}

export interface Area {
  area_id: string;
  area_name?: string;
}

export interface Attribution {
  attribution_id?: string;
  agency_id?: string;
  route_id?: string;
  trip_id?: string;
  organization_name: string;
  is_producer?: 0 | 1;
  is_operator?: 0 | 1;
  is_authority?: 0 | 1;
  attribution_url?: string;
  attribution_email?: string;
  attribution_phone?: string;
}

export interface BookingRule {
  booking_rule_id: string;
  booking_type: 0 | 1 | 2;
  prior_notice_duration_min?: number;
  prior_notice_duration_max?: number;
  prior_notice_last_day?: number;
  prior_notice_last_time?: string;
  prior_notice_last_timestamp?: UnixTimestamp;
  prior_notice_start_day?: number;
  prior_notice_start_time?: string;
  prior_notice_start_timestamp?: UnixTimestamp;
  prior_notice_service_id?: string;
  message?: string;
  pickup_message?: string;
  drop_off_message?: string;
  phone_number?: string;
  info_url?: string;
  booking_url?: string;
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
  holiday_name?: string;
}

export interface FareAttribute {
  fare_id: string;
  price: number;
  currency_type: string;
  payment_method: 0 | 1;
  transfers: 0 | 1 | 2;
  agency_id?: string;
  transfer_duration?: number;
}

export interface FareLegRule {
  leg_group_id?: string;
  network_id?: string;
  from_area_id?: string;
  to_area_id?: string;
  from_timeframe_group_id?: string;
  to_timeframe_group_id?: string;
  fare_product_id: string;
  rule_priority?: number;
}

export interface FareMedia {
  fare_media_id: string;
  fare_media_name?: string;
  fare_media_type: 0 | 1 | 2 | 3 | 4;
}

export interface FareProduct {
  fare_product_id: string;
  fare_product_name?: string;
  fare_media_id?: string;
  amount: number;
  currency: string;
}

export interface FareRule {
  fare_id: string;
  route_id?: string;
  origin_id?: string;
  destination_id?: string;
  contains_id?: string;
}

export interface FareTransferRule {
  from_leg_group_id?: string;
  to_leg_group_id?: string;
  transfer_count?: number;
  duration_limit: number;
  duration_limit_type?: 0 | 1 | 2 | 3;
  fare_transfer_type: 0 | 1 | 2;
  fare_product_id?: string;
}

export interface FeedInfo {
  feed_publisher_name: string;
  feed_publisher_url: string;
  feed_lang: string;
  default_lang?: string;
  feed_start_date?: number;
  feed_end_date?: number;
  feed_version?: string;
  feed_contact_email?: string;
  feed_contact_url?: string;
}

export interface Frequency {
  trip_id: string;
  start_time: string;
  start_timestamp: UnixTimestamp;
  end_time: string;
  end_timestamp: UnixTimestamp;
  headway_secs: number;
  exact_times?: 0 | 1;
}

export interface Level {
  level_id: string;
  level_index: number;
  level_name?: string;
}

export interface LocationGroupStop {
  location_group_id: string;
  stop_id: string;
}

export interface LocationGroup {
  location_group_id: string;
  location_group_name?: string;
}

export interface Location {
  geojson: string;
}

export interface Network {
  network_id: string;
  network_name?: string;
}

export interface Pathway {
  pathway_id: string;
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  is_bidirectional: 0 | 1;
  length?: number;
  traversal_time?: number;
  stair_count?: number;
  max_slope?: number;
  min_width?: number;
  signposted_as?: string;
  reversed_signposted_as?: string;
}

export interface RouteNetwork {
  network_id: string;
  route_id: string;
}

export interface Route {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_desc?: string;
  route_type: number;
  route_url?: string;
  route_color?: string;
  route_text_color?: string;
  route_sort_order?: number;
  continuous_pickup?: 0 | 1 | 2 | 3;
  continuous_drop_off?: 0 | 1 | 2 | 3;
  network_id?: string;
}

export interface Shape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled?: number;
}

export interface StopArea {
  area_id: string;
  stop_id: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time?: string;
  arrival_timestamp?: UnixTimestamp;
  departure_time?: string;
  departure_timestamp?: UnixTimestamp;
  location_group_id?: string;
  location_id?: string;
  stop_id?: string;
  stop_sequence: number;
  stop_headsign?: string;
  start_pickup_drop_off_window?: string;
  start_pickup_drop_off_window_timestamp?: UnixTimestamp;
  pickup_type?: 0 | 1 | 2 | 3;
  drop_off_type?: 0 | 1 | 2 | 3;
  continuous_pickup?: 0 | 1 | 2 | 3;
  continuous_drop_off?: 0 | 1 | 2 | 3;
  shape_dist_traveled?: number;
  timepoint?: 0 | 1;
  pickup_booking_rule_id?: string;
  drop_off_booking_rule_id?: string;
}

export interface Stop {
  stop_id: string;
  stop_code?: string;
  stop_name?: string;
  tts_stop_name?: string;
  stop_desc?: string;
  stop_lat?: number;
  stop_lon?: number;
  zone_id?: string;
  stop_url?: string;
  location_type?: 0 | 1 | 2 | 3 | 4;
  parent_station?: string;
  stop_timezone?: string;
  wheelchair_boarding?: 0 | 1 | 2;
  level_id?: string;
  platform_code?: string;
}

export interface Timeframe {
  timeframe_group_id: string;
  start_time?: string;
  end_time?: string;
  service_id: string;
}

export interface Transfer {
  from_stop_id?: string;
  to_stop_id?: string;
  from_route_id?: string;
  to_route_id?: string;
  from_trip_id?: string;
  to_trip_id?: string;
  transfer_type: 0 | 1 | 2 | 3 | 4 | 5;
  min_transfer_time?: number;
}

export interface Translation {
  table_name: string;
  field_name: string;
  language: string;
  translation: string;
  record_id?: string;
  record_sub_id?: string;
  field_value?: string;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: 0 | 1;
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: 0 | 1 | 2;
  bikes_allowed?: 0 | 1 | 2;
  cars_allowed?: 0 | 1 | 2;
}

export interface Timetable {
  timetable_id: string;
  route_id: string;
  direction_id?: 0 | 1;
  start_date?: number;
  end_date?: number;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  start_time?: string;
  start_timestamp?: UnixTimestamp;
  end_time?: string;
  end_timestamp?: UnixTimestamp;
  timetable_label?: string;
  service_notes?: string;
  orientation?: string;
  timetable_page_id?: string;
  timetable_sequence?: number;
  direction_name?: string;
  include_exceptions?: 0 | 1;
  show_trip_continuation?: 0 | 1;
}

export interface TimetablePage {
  timetable_page_id: string;
  timetable_page_label?: string;
  filename?: string;
}

export interface TimetableStopOrder {
  timetable_id: string;
  stop_id: string;
  stop_sequence: number;
}

export interface TimetableNote {
  note_id: string;
  symbol?: string;
  note: string;
}

export interface TimetableNotesReference {
  note_id: string;
  timetable_id: string;
  route_id?: string;
  trip_id?: string;
  stop_id?: string;
  stop_sequence?: number;
  show_on_stoptime?: 0 | 1;
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
  ops_location_id?: string;
  stop_id?: string;
  location_sequence: number;
  shape_dist_traveled?: number;
}

export interface Deadhead {
  deadhead_id: string;
  service_id: string;
  block_id: string;
  shape_id?: string;
  to_trip_id?: string;
  from_trip_id?: string;
  to_deadhead_id?: string;
  from_deadhead_id?: string;
}

export interface OpsLocation {
  ops_location_id: string;
  ops_location_code?: string;
  ops_location_name: string;
  ops_location_desc?: string;
  ops_location_lat: number;
  ops_location_lon: number;
}

export interface RunEvent {
  run_event_id: string;
  piece_id: string;
  event_type: number;
  event_name?: string;
  event_time: string;
  event_duration: number;
  event_from_location_type: 0 | 1;
  event_from_location_id?: string;
  event_to_location_type: 0 | 1;
  event_to_location_id?: string;
}

export interface RunPiece {
  run_id: string;
  piece_id: string;
  start_type: 0 | 1 | 2;
  start_trip_id: string;
  start_trip_position?: number;
  end_type: 0 | 1 | 2;
  end_trip_id: string;
  end_trip_position?: number;
}

export interface ServiceAlert {
  cause: number;
  start_time: string;
  end_time: string;
  headline: string;
  description: string;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface StopTimeUpdate {
  trip_id?: string;
  trip_start_time?: string;
  direction_id?: 0 | 1;
  route_id?: string;
  stop_id?: string;
  stop_sequence?: number;
  arrival_delay?: number;
  departure_delay?: number;
  departure_timestamp?: UnixTimestamp;
  arrival_timestamp?: UnixTimestamp;
  schedule_relationship?: string;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface TripUpdate {
  update_id: string;
  vehicle_id?: string;
  trip_id?: string;
  trip_start_time?: string;
  direction_id?: 0 | 1;
  route_id?: string;
  start_date?: number;
  timestamp?: UnixTimestamp;
  schedule_relationship?: string;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface VehiclePosition {
  update_id: string;
  bearing?: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  current_stop_sequence?: number;
  trip_id?: string;
  trip_start_date?: number;
  trip_start_time?: string;
  congestion_level?: string;
  occupancy_status?: string;
  occupancy_percentage?: number;
  vehicle_stop_status?: string;
  vehicle_id?: string;
  vehicle_label?: string;
  vehicle_license_plate?: string;
  vehicle_wheelchair_accessible?: number;
  timestamp?: UnixTimestamp;
  created_timestamp: UnixTimestamp;
  expiration_timestamp: UnixTimestamp;
}

export interface BoardAlight {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  record_use: 0 | 1;
  schedule_relationship?: number;
  boardings?: number;
  alightings?: number;
  current_load?: number;
  load_count?: number;
  load_type?: number;
  rack_down?: number;
  bike_boardings?: number;
  bike_alightings?: number;
  ramp_used?: number;
  ramp_boardings?: number;
  ramp_alightings?: number;
  service_date?: number;
  service_arrival_time?: string;
  service_arrival_timestamp?: UnixTimestamp;
  service_departure_time?: string;
  service_departure_timestamp?: UnixTimestamp;
  source?: 0 | 1 | 2 | 3 | 4;
}

export interface RideFeedInfo {
  ride_files: number;
  ride_start_date?: number;
  ride_end_date?: number;
  gtfs_feed_date?: number;
  default_currency_type?: string;
  ride_feed_version?: string;
}

export interface RiderCategory {
  rider_category_id: string;
  rider_category_name: string;
  is_default_fare_category?: 0 | 1;
  eligibility_url?: string;
}

export interface RiderTrip {
  rider_id: string;
  agency_id?: string;
  trip_id?: string;
  boarding_stop_id?: string;
  boarding_stop_sequence?: number;
  alighting_stop_id?: string;
  alighting_stop_sequence?: number;
  service_date?: number;
  boarding_time?: string;
  boarding_timestamp?: UnixTimestamp;
  alighting_time?: string;
  alighting_timestamp?: UnixTimestamp;
  rider_type?: number;
  rider_type_description?: string;
  fare_paid?: number;
  transaction_type?: number;
  fare_media?: number;
  accompanying_device?: number;
  transfer_status?: number;
}

export interface Ridership {
  total_boardings: number;
  total_alightings: number;
  ridership_start_date?: number;
  ridership_end_date?: number;
  ridership_start_time?: string;
  ridership_start_timestamp?: UnixTimestamp;
  ridership_end_time?: string;
  ridership_end_timestamp?: UnixTimestamp;
  service_id?: string;
  monday?: 0 | 1;
  tuesday?: 0 | 1;
  wednesday?: 0 | 1;
  thursday?: 0 | 1;
  friday?: 0 | 1;
  saturday?: 0 | 1;
  sunday?: 0 | 1;
  agency_id?: string;
  route_id?: string;
  direction_id?: 0 | 1;
  trip_id?: string;
  stop_id?: string;
}

export interface TripCapacity {
  agency_id?: string;
  trip_id?: string;
  service_date?: number;
  vehicle_description?: string;
  seated_capacity?: number;
  standing_capacity?: number;
  wheelchair_capacity?: number;
  bike_capacity?: number;
}

export interface CalendarAttribute {
  service_id: string;
  service_description: string;
}

export interface Direction {
  route_id: string;
  direction_id?: 0 | 1;
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
  accessibility_id?: number;
  cardinal_direction?: string;
  relative_position?: string;
  stop_city?: string;
}
