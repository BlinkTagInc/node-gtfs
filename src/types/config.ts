import type { Options as CsvParseOptions } from 'csv-parse';
import type { Database as SqliteDatabase } from 'better-sqlite3';

import type { GtfsFileBackedTableName } from '../schema/database.ts';
import type { ReportingOptions } from '../reporting/types.ts';

export interface SqliteConnectionOptions {
  /** Existing synchronous SQLite connection. */
  db?: SqliteDatabase;
  /** SQLite database path. Defaults to an in-memory database. */
  sqlitePath?: string;
}

export interface GtfsRealtimeEndpoint {
  url: string;
  headers?: Readonly<Record<string, string>>;
}

interface GtfsFeedOptions {
  /** File-backed tables to exclude from this feed. */
  exclude?: readonly GtfsFileBackedTableName[];
  /** HTTP headers used when downloading the static feed. */
  headers?: Readonly<Record<string, string>>;
  realtimeAlerts?: GtfsRealtimeEndpoint;
  realtimeTripUpdates?: GtfsRealtimeEndpoint;
  realtimeVehiclePositions?: GtfsRealtimeEndpoint;
  /** Prefix applied to identifiers while merging feeds. */
  prefix?: string;
  fillEmptyAgencyId?: boolean;
  agencyId?: string;
}

type StaticGtfsSource =
  { url: string; path?: never } | { path: string; url?: never };

/** One static GTFS feed and its optional Realtime endpoints. */
export type GtfsFeedConfig = GtfsFeedOptions & StaticGtfsSource;

/** One set of GTFS-Realtime endpoints. A static source is not required. */
export interface GtfsRealtimeFeedConfig {
  realtimeAlerts?: GtfsRealtimeEndpoint;
  realtimeTripUpdates?: GtfsRealtimeEndpoint;
  realtimeVehiclePositions?: GtfsRealtimeEndpoint;
  prefix?: string;
}

export interface DownloadOptions {
  /** Download timeout in milliseconds. Defaults to 30000. */
  downloadTimeout?: number;
}

export interface ImportBehaviorOptions {
  csvOptions?: CsvParseOptions;
  ignoreDuplicates?: boolean;
  ignoreErrors?: boolean;
  includeImportReport?: boolean;
}

/** Database-independent static GTFS import configuration. */
export interface GtfsImportConfig
  extends DownloadOptions, ImportBehaviorOptions, ReportingOptions {
  agencies: readonly GtfsFeedConfig[];
  /** Realtime row lifetime in seconds. Defaults to 0. */
  gtfsRealtimeExpirationSeconds?: number;
}

/** Static GTFS import configuration for the built-in SQLite writer. */
export interface GtfsSqliteImportConfig
  extends GtfsImportConfig, SqliteConnectionOptions {}

/** Configuration for exporting an existing SQLite GTFS database. */
export interface GtfsExportConfig
  extends SqliteConnectionOptions, ReportingOptions {
  exportPath?: string;
}

/** Configuration for refreshing GTFS-Realtime data in SQLite. */
export interface GtfsRealtimeConfig
  extends SqliteConnectionOptions, DownloadOptions, ReportingOptions {
  agencies: readonly GtfsRealtimeFeedConfig[];
  gtfsRealtimeExpirationSeconds?: number;
  ignoreErrors?: boolean;
}

export type ImportConfigWithReport = GtfsImportConfig & {
  includeImportReport: true;
};

export type SqliteImportConfigWithReport = GtfsSqliteImportConfig & {
  includeImportReport: true;
};
