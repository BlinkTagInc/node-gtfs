import CsvParse = require('csv-parse');

import Database = require('better-sqlite3');

import { FeatureCollection, Geometry } from '@turf/helpers';

export {}; // disable implicit exporting of types

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

export type JoinTables = JoinOptions[];

export type SqlResults = Array<Record<string, any>>;

export type SqlQueryString = string;

export type SqlTableName = string;

export type Config = ExportConfig & ImportConfig;

export interface AdvancedQueryOptions {
  /**
   * Queries the database with support for table joins and custom tables and returns an array of data.
   */
  query?: SqlWhere;
  fields?: SqlSelect;
  orderBy?: SqlOrderBy;
  join?: JoinOptions[];
  options?: QueryOptions;
}

export interface JoinOptions {
  /**
   * Options for joining, type
   */
  type?: 'LEFT OUTER' | 'INNER';
  table: string;
  on: string;
}

interface VerboseConfig {
  /**
   * Whether or not to print output to the console. Defaults to true.
   */
  verbose?: boolean;
}

export interface DbConfig {
  /**
   * A path to a SQLite database. Defaults to using an in-memory database.
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
   * An array of agencies with GTFS files to be imported.
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
  db?: Database.Database;
}

/**
 * Use exportGtfs() in your code to run an export of a GTFS from SQLite specified in a config.json file.
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
 * Opens the database specified in the config object.
 */
export function openDb(config: DbConfig): Database.Database;

/**
 * Closes the specified database.
 */
export function closeDb(db?: Database.Database): void;

/**
 * Returns an array of agencies that match query parameters.
 */
export function getAgencies(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of areas that match query parameters.
 */
export function getAreas(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of attributions that match query parameters.
 */
export function getAttributions(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of routes that match query parameters.
 */
export function getRoutes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of stops that match query parameters.
 */
export function getStops(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns geoJSON object of stops that match query parameters.
 * All valid queries for `getStops()` work for `getStopsAsGeoJSON()`.
 */
export function getStopsAsGeoJSON(
  query?: SqlWhere,
  options?: QueryOptions
): Promise<FeatureCollection<Geometry, { [name: string]: any }>>;

/**
 * Returns an array of stop_times that match query parameters.
 */
export function getStoptimes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of trips that match query parameters.
 */
export function getTrips(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of shapes that match query parameters.
 */
export function getShapes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns a geoJSON object of shapes that match query parameters.
 * All valid queries for `getShapes()` work for `getShapesAsGeoJSON()`.
 */
export function getShapesAsGeoJSON(
  query?: SqlWhere,
  options?: QueryOptions
): FeatureCollection<Geometry, { [name: string]: any }>;

/**
 * Returns an array of calendars that match query parameters.
 */
export function getCalendars(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of calendar_dates that match query parameters.
 */
export function getCalendarDates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of fare_attributes that match query parameters.
 */
export function getFareAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of fare_leg_rules that match query parameters.
 */
export function getFareLegRules(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of fare_products that match query parameters.
 */
export function getFareProducts(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of fare_rules that match query parameters.
 */
export function getFareRules(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of fare_transfer_rules that match query parameters.
 */
export function getFareTransferRules(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of feed_info that match query parameters.
 */
export function getFeedInfo(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of frequencies that match query parameters.
 */
export function getFrequencies(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of levels that match query parameters.
 */
export function getLevels(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of pathways that match query parameters.
 */
export function getPathways(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of transfers that match query parameters.
 */
export function getTransfers(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of translations that match query parameters.
 */
export function getTranslations(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of stop_areas that match query parameters.
 */
export function getStopAreas(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of calendar_attributes that match query parameters.
 * This is for the non-standard `calendar_attributes.txt` file.
 */
export function getCalendarAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of directions that match query parameters.
 * This is for the non-standard `directions.txt` file.
 */
export function getDirections(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of route_attributes that match query parameters.
 * This is for the non-standard `route_attributes.txt` file.
 */
export function getRouteAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of stop_attributes that match query parameters.
 * This is for the non-standard `stop_attributes.txt` file.
 */
export function getStopAttributes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of timetables that match query parameters.
 * This is for the non-standard `timetables.txt` file used in GTFS-to-HTML.
 */
export function getTimetables(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of timetable_stop_orders that match query parameters.
 * This is for the non-standard `timetable_stop_order.txt` file used in GTFS-to-HTML.
 */
export function getTimetableStopOrders(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of timetable_pages that match query parameters.
 * This is for the non-standard `timetable_pages.txt` file used in GTFS-to-HTML.
 */
export function getTimetablePages(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of timetable_notes that match query parameters.
 * This is for the non-standard `timetable_notes.txt` file used in GTFS-to-HTML.
 */
export function getTimetableNotes(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of timetable_notes_references that match query parameters.
 * This is for the non-standard `timetable_notes_references.txt` file used in GTFS-to-HTML.
 */
export function getTimetableNotesReferences(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of trips_dated_vehicle_journey that match query parameters.
 * This is for the non-standard `trips_dated_vehicle_journey.txt` file.
 */
export function getTripsDatedVehicleJourneys(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of GTFS Realtime service alerts that match query parameters.
 * This only works if you configure GTFS Realtime import in node-gtfs.
 */
export function getServiceAlerts(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of GTFS Realtime trip updates that match query parameters.
 * This only works if you configure GTFS Realtime import in node-gtfs.
 */
export function getTripUpdates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of GTFS Realtime stop time updates that match query parameters.
 * This only works if you configure GTFS Realtime import in node-gtfs.
 */
export function getStopTimesUpdates(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Returns an array of GTFS Realtime vehicle positions that match query parameters.
 * This only works if you configure GTFS Realtime import in node-gtfs.
 */
export function getVehiclePositions(
  query?: SqlWhere,
  fields?: SqlSelect,
  sortBy?: SqlOrderBy,
  options?: QueryOptions
): SqlResults;

/**
 * Runs an advanced query.
 */
export function advancedQuery(
  table?: SqlTableName,
  advancedQueryOptions?: AdvancedQueryOptions
): SqlResults;
