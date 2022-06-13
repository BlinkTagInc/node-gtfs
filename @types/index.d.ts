import CsvParse = require('csv-parse');
import * as Sqlite3 from 'sqlite';
import { FeatureCollection, Geometry } from '@turf/helpers';

export {}; // disable implicit exporting of types

type Unpromise<T> = T extends Promise<infer U> ? U : T;

export type SqlDatabase = Unpromise<ReturnType<typeof Sqlite3.open>>;

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

export type SqlOrderBy = Array<[string, 'ASC' | 'DESC']>;

export type JoinTables = Array<JoinOptions>;

export type SqlResults = Array<Record<string, any>>;

export type SqlQueryString = string;

export type SqlTableName = string;

export type Config = ExportConfig & ImportConfig;

export type AdvancedQueryOptions = {
  /**
   * An advanced query
   */
  query?: SqlWhere;
  fields?: SqlSelect;
  orderBy?: SqlOrderBy;
  join?: Array<JoinOptions>;
  options?: QueryOptions;
};

export type JoinOptions = {
  /**
   * Options for joining, type
   */
  type?: 'LEFT OUTER' | 'INNER';
  table: string;
  on: string;
};
interface VerboseConfig {
  /**
   * Whether or not to print output to the console. Defaults to true.
   */
  verbose?: boolean;
}

export interface DbConfig {
  /**
   * A path to an SQLite database. Defaults to using an in-memory database.
   */
  sqlitePath?: string;
}

export interface ExportConfig extends DbConfig, VerboseConfig {
  /**
   * Path to a directory to store exported GTFS files. Defaults to `gtfs-export/<agency_name>`.
   */
  exportPath?: string;
}

export interface ImportConfig extends DbConfig, VerboseConfig {
  /**
   * An array of GTFS files to be imported.
   */
  agencies: Array<{
    /**
     * Exclude files - if you don't want all GTFS files to be imported,
     * you can specify an array of files to exclude.
     */
    exclude?: string[];

    /**
     * Specify custom headers for download URL.
     */
    headers?: Record<string, string>;

    /**
     * Specify custom headers for download URL.
     */
    realtimeHeaders?: Record<string, string>;

    /**
     * Specify a path to a zipped GTFS file or an unzipped GTFS directory.
     * One of `url` or `path` must be provided.
     */
    path?: string;

    /**
     * Specify a download URL. One of `url` or `path` must be provided.
     */
    url?: string;

    /**
     * Specify an array of download URLs for GTFS-Realtime data
     */
    realtimeUrls?: string[];
  }>;

  /**
   * Options passed to csv-parse for parsing GTFS CSV files.
   */
  csvOptions?: CsvParse.Options;
}

export interface QueryOptions {
  db?: SqlDatabase;
}

/**
 * Use exportGtfs() in your code to run an export of a GTFS file specified in a config.json file.
 */
export function exportGtfs(config: ExportConfig): Promise<void>;

/**
 * Use importGtfs() in your code to run an import of a GTFS file specified in a config.json file.
 */
export function importGtfs(config: ImportConfig): Promise<void>;

/**
 * Use updateGtfsRealtime() in your code to run an update of a GTFS-Realtime data specified in a config.json file.
 */
export function updateGtfsRealtime(config: ImportConfig): Promise<void>;

/**
 * Open database before making any queries.
 */
export function openDb(config: DbConfig): Promise<SqlDatabase>;

/**
 * Closes open database.
 */
export function closeDb(db?: SqlDatabase): Promise<void>;

/**
 * Get open database. Throws error if no database is open.
 */
export function getDb(config?: DbConfig): Promise<SqlDatabase>;

/**
 * Queries agencies and returns a promise for an array of agencies.
 */
export function getAgencies(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries attributions and returns a promise for an array of attributions.
 */
export function getAttributions(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries routes and returns a promise for an array of routes.
 */
export function getRoutes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries stops and returns a promise for an array of stops.
 */
export function getStops(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries stops and returns a promise for an geoJSON object of stops.
 * All valid queries for `getStops()` work for `getStopsAsGeoJSON()`.
 */
export function getStopsAsGeoJSON(
  query?: SqlWhere,
  options?: QueryOptions
): Promise<FeatureCollection<Geometry, { [name: string]: any }>>;

/**
 * Queries `stop_times` and returns a promise for an array of stop_times.
 */
export function getStoptimes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trips and returns a promise for an array of trips.
 */
export function getTrips(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries shapes and returns a promise for an array of shapes.
 */
export function getShapes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries shapes and returns a promise for an geoJSON object of shapes.
 * All valid queries for `getShapes()` work for `getShapesAsGeoJSON()`.
 */
export function getShapesAsGeoJSON(
  query?: SqlWhere,
  options?: QueryOptions
): Promise<FeatureCollection<Geometry, { [name: string]: any }>>;

/**
 * Queries calendars and returns a promise for an array of calendars.
 */
export function getCalendars(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries calendar_dates and returns a promise for an array of calendar_dates.
 */
export function getCalendarDates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries fare_attributes and returns a promise for an array of fare_attributes.
 */
export function getFareAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries fare_rules and returns a promise for an array of fare_rules.
 */
export function getFareRules(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries feed_info and returns a promise for an array of feed_infos.
 */
export function getFeedInfo(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries frequencies and returns a promise for an array of frequencies.
 */
export function getFrequencies(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries levels and returns a promise for an array of levels.
 */
export function getLevels(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries pathways and returns a promise for an array of pathways.
 */
export function getPathways(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries transfers and returns a promise for an array of transfers.
 */
export function getTransfers(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries translations and returns a promise for an array of translations.
 */
export function getTranslations(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries directions and returns a promise for an array of directions.
 * These are from the non-standard `directions.txt` file.
 */
export function getDirections(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries stop_attributes and returns a promise for an array of stop_attributes.
 * These are from the non-standard `stop_attributes.txt` file.
 */
export function getStopAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries timetables and returns a promise for an array of timetables.
 * These are from the non-standard `timetables.txt` file.
 */
export function getTimetables(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries timetable_stop_orders and returns a promise for an array of timetable_stop_orders.
 * These are from the non-standard `timetable_stop_order.txt` file.
 */
export function getTimetableStopOrders(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries timetable_pages and returns a promise for an array of timetable_pages.
 * These are from the non-standard `timetable_pages.txt` file.
 */
export function getTimetablePages(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries timetable_notes and returns a promise for an array of timetable_notes.
 * These are from the non-standard `timetable_notes.txt` file.
 */
export function getTimetableNotes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries timetable_notes_references and returns a promise for an array of timetable_notes references.
 * These are from the non-standard `timetable_notes_references.txt` file.
 */
export function getTimetableNotesReferences(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries board-alights and returns a promise for an array of board-alights.
 */
export function getBoardAlights(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries ride-feed-info and returns a promise for an array of ride-feed-info.
 */
export function getRideFeedInfos(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries rider trips and returns a promise for an array of rider trips.
 */
export function getRiderTrips(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries riderships and returns a promise for an array of riderships.
 */
export function getRiderships(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trip-capacities and returns a promise for an array of trip-capacities.
 */
export function getTripCapacities(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trip-capacities and returns a promise for an array of service-alerts.
 */
export function getServiceAlerts(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trip-capacities and returns a promise for an array of trip-updates.
 */
export function getTripUpdates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trip-capacities and returns a promise for an array of vehicle-positions.
 */
export function getVehiclePositions(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Queries trip-capacities and returns a promise for an array of stop-times-updates.
 */
export function getStopTimesUpdates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Runs an advanced query.
 */
export function advancedQuery(
  table?: SqlTableName,
  advancedQueryOptions?: AdvancedQueryOptions
): Promise<SqlResults>;

/**
 * Runs an raw query retuning all rows.
 */
export function runRawQuery(
  sql?: SqlQueryString,
  options?: QueryOptions
): Promise<SqlResults>;

/**
 * Executing an raw query.
 */
export function execRawQuery(
  sql?: SqlQueryString,
  options?: QueryOptions
): Promise<any>;
