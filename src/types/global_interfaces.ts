import type { Options } from 'csv-parse';
import type { Database } from 'better-sqlite3';
import type { GtfsScheduleTableName } from '../schema/database.ts';

export type UnixTimestamp = number;

export type TableNames = GtfsScheduleTableName;

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
  /**
   * When set to true and the feed contains exactly one agency, populates any empty `agency_id` fields
   * on routes, fare_attributes, and other relevant files. Useful when merging single-agency feeds into
   * a shared database.
   *
   * @defaultValue false
   */
  fillEmptyAgencyId?: boolean;
  /**
   * Explicit `agency_id` to use when `fillEmptyAgencyId` is true and `agency.txt` does not define
   * one. Also backfills the `agency_id` on the agency row itself. If `agency.txt` already defines
   * an `agency_id` and it differs from this value, the value from `agency.txt` takes precedence.
   */
  agencyId?: string;
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
   * Whether or not to return a structured import report from `importGtfs`.
   * Useful when `ignoreErrors` is enabled and you want to inspect collected errors/warnings.
   *
   * @defaultValue false
   */
  includeImportReport?: boolean;
  /**
   * An array of GTFS files to be imported, and which files to exclude.
   */
  agencies: ConfigAgency[];
  /**
   * Whether or not to print output to the console.
   *
   * @deprecated Use `logLevel` instead. `false` maps to `logLevel: 'warning'`,
   * which is what it has always meant: no progress, but warnings and errors.
   */
  verbose?: boolean;
  /**
   * How much to print. Each level includes the ones above it, so `warning`
   * prints errors as well.
   *
   * @defaultValue 'info'
   */
  logLevel?: LogLevel;
  /**
   * An optional destination for log output instead of the console. Receives
   * every message `logLevel` lets through, with the level it was logged at.
   *
   * The progress line is not sent here: it redraws in place, so it would
   * arrive as hundreds of near-identical messages.
   */
  logFunction?: LogFunction;
}

/** How much a run prints. Nothing is ever logged at `silent`. */
export type LogLevel = 'silent' | 'error' | 'warning' | 'info';

/** The levels a single message can be logged at. */
export type LogMessageLevel = Exclude<LogLevel, 'silent'>;

/** A custom destination for log output. */
export type LogFunction = (level: LogMessageLevel, message: string) => void;

export interface JoinOptions {
  type?: string;
  table: string;
  on: string;
}

export type SqlValue =
  undefined | null | string | number | boolean | SqlValue[];

export type SqlWhere = Record<string, null | SqlValue | SqlValue[]>;

/**
 * A value in a form better-sqlite3 can bind to a statement parameter.
 */
export type SqlBindValue = null | string | number | bigint;

/**
 * A SQL fragment paired with the values bound to its `?` placeholders.
 * `params` are ordered to match the placeholders in `clause`, so callers
 * composing several fragments must concatenate `params` in the same order the
 * fragments appear in the final statement.
 */
export interface SqlClause {
  clause: string;
  params: SqlBindValue[];
}

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

export type * from '../schema/row-types.ts';
