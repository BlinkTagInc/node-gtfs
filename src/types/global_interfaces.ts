import { Options } from 'csv-parse';
import { Database } from 'better-sqlite3';

export interface ConfigAgency {
  exclude?: string[];
  url?: string;
  path?: string;
  headers?: Record<string, string>;
  realtimeAlerts?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeTripUpdates?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeVehiclePositions?: {
    url: string;
    headers?: Record<string, string>;
  };
  prefix?: string;
}

export interface Config {
  db?: Database;
  sqlitePath?: string;
  gtfsRealtimeExpirationSeconds?: number;
  downloadTimeout?: number;
  csvOptions?: Options;
  exportPath?: string;
  ignoreDuplicates?: boolean;
  ignoreErrors?: boolean;
  agencies: ConfigAgency[];
  verbose?: boolean;
  logFunction?: (message: string) => void;
}

export interface ModelColumn {
  name: string;
  type: string;
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
  filenameBase: string;
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

export type SqlSelect = string[];

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

export type SqlResults = Array<Record<string, any>>;

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
  prior_notice_last_timestamp?: number;
  prior_notice_start_day?: number;
  prior_notice_start_time?: string;
  prior_notice_start_timestamp?: number;
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
  start_timestamp: number;
  end_time: string;
  end_timestamp: number;
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
  arrival_timestamp?: number;
  departure_time?: string;
  departure_timestamp?: number;
  location_group_id?: string;
  location_id?: string;
  stop_id?: string;
  stop_sequence: number;
  stop_headsign?: string;
  start_pickup_drop_off_window?: string;
  start_pickup_drop_off_window_timestamp?: number;
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
}
