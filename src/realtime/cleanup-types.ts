import type { Kysely } from 'kysely';

import type { GtfsDatabase } from '../schema/database.ts';
import type { GtfsReportingConfig } from '../reporting/types.ts';
import type { GtfsExtensionOptions } from '../schema/extensions.ts';
import { GTFS_REALTIME_CURRENT_STATE_TABLES } from './entity-tables.ts';

export const GTFS_REALTIME_CLEANUP_TABLES = [
  ...GTFS_REALTIME_CURRENT_STATE_TABLES,
  'realtime_feed_entities',
  'realtime_snapshots',
] as const;

export type GtfsRealtimeCleanupTable =
  (typeof GTFS_REALTIME_CLEANUP_TABLES)[number];

export interface GtfsRealtimeCleanupOptions<
  DB = GtfsDatabase,
> extends GtfsExtensionOptions {
  /** Caller-owned Kysely instance. */
  readonly database: Kysely<DB>;
  /** Structured reporting configuration. Cleanup is silent by default. */
  readonly reporting?: GtfsReportingConfig;
  /** Unix time in seconds. Defaults to the time at which cleanup starts. */
  readonly nowUnixSeconds?: number;
  /** Limit cleanup to these source IDs. Omit to clean every source. */
  readonly sourceIds?: readonly string[];
  /** Clean expired current query projections. Defaults to true. */
  readonly currentState?: boolean;
  /** Clean expired snapshot, feed-entity, and raw-payload history. */
  readonly snapshotHistory?: boolean;
}

export interface GtfsRealtimeCleanupResult {
  readonly nowUnixSeconds: number;
  readonly deletedRowsByTable: Readonly<
    Record<GtfsRealtimeCleanupTable, number>
  >;
  readonly currentStateRowsDeleted: number;
  readonly snapshotHistoryRowsDeleted: number;
  readonly totalRowsDeleted: number;
}

export type GtfsInstanceRealtimeCleanupOptions = Omit<
  GtfsRealtimeCleanupOptions,
  'database' | 'extensions' | 'reporting' | 'sourceIds'
>;

export interface ResolvedGtfsRealtimeCleanupOptions {
  readonly reporting: GtfsReportingConfig;
  readonly nowUnixSeconds: number;
  readonly sourceIds?: readonly string[];
  readonly currentState: boolean;
  readonly snapshotHistory: boolean;
}
