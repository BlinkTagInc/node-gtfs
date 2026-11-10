import type { Database as SqliteDatabase } from 'better-sqlite3';

import type { Kysely } from 'kysely';

import type { GtfsFileBackedFilename } from '../schema/database.ts';
import type { GtfsDatabase } from '../schema/database.ts';
import type { GtfsReporter, GtfsReportingConfig } from '../reporting/types.ts';
import type { SqliteDurability } from '../database/sqlite/durability.ts';
import type {
  GtfsExtensionOptions,
  GtfsImportExtensionOptions,
  GtfsImportExtensionSelection,
} from '../schema/extensions.ts';

/** A recursively JSON-serializable value. */
export type GtfsJsonValue =
  | boolean
  | number
  | string
  | null
  | readonly GtfsJsonValue[]
  | { readonly [key: string]: GtfsJsonValue };

export type GtfsValidationMode = 'off' | 'strict' | 'permissive';
export type GtfsUnknownFieldsPolicy = 'reject' | 'preserve' | 'discard';
export type GtfsDuplicateKeysPolicy = 'reject' | 'keep-first';
export type GtfsSourceErrorsPolicy = 'abort' | 'continue';
export type GtfsExistingDataPolicy = 'replace-source' | 'reject';

/** Database settings for an owned SQLite database. */
export interface GtfsOwnedSqliteDatabaseConfig {
  readonly path?: string;
  readonly durability?: SqliteDurability;
  readonly client?: never;
}

/** Database settings for a caller-owned native SQLite connection. */
export interface GtfsBorrowedNativeSqliteDatabaseConfig {
  readonly client: SqliteDatabase;
  readonly path?: never;
  readonly durability?: never;
}

/** Database settings for a caller-owned portable Kysely connection. */
export interface GtfsBorrowedKyselyDatabaseConfig<DB = GtfsDatabase> {
  readonly client: Kysely<DB>;
  readonly path?: never;
  readonly durability?: never;
}

export type GtfsDatabaseConfig<DB = GtfsDatabase> =
  | GtfsOwnedSqliteDatabaseConfig
  | GtfsBorrowedNativeSqliteDatabaseConfig
  | GtfsBorrowedKyselyDatabaseConfig<DB>;

export interface GtfsCsvParseOptions {
  readonly encoding?: 'utf8' | 'utf16le' | 'latin1';
  readonly delimiter?: string;
  readonly quote?: string | false;
  readonly escape?: string;
  readonly trim?: boolean;
  readonly skipEmptyLines?: boolean;
  readonly relaxQuotes?: boolean;
}

export interface GtfsScheduleValidationConfig {
  /** Defaults to off. Parsing, normalization, and database constraints still apply. */
  readonly mode?: GtfsValidationMode;
  readonly onUnknownField?: GtfsUnknownFieldsPolicy;
  readonly onDuplicateKey?: GtfsDuplicateKeysPolicy;
}

export interface GtfsScheduleArchiveConfig {
  /** Applies to both downloaded and local ZIP files. Defaults to 1 GiB. */
  readonly maxCompressedBytes?: number;
  /** Includes files and directory entries. Defaults to 1000. */
  readonly maxEntries?: number;
  /** Maximum extracted bytes per file. Defaults to 4 GiB. */
  readonly maxExtractedFileBytes?: number;
  /** Maximum extracted bytes across the archive. Defaults to 8 GiB. */
  readonly maxExtractedTotalBytes?: number;
}

export interface GtfsScheduleImportConfig {
  readonly archive?: GtfsScheduleArchiveConfig;
  readonly onSourceError?: GtfsSourceErrorsPolicy;
  readonly csv?: GtfsCsvParseOptions;
  readonly onExistingData?: GtfsExistingDataPolicy;
  readonly validation?: GtfsScheduleValidationConfig;
}

interface GtfsScheduleSourceCommon {
  readonly excludeFiles?: readonly GtfsFileBackedFilename[];
  /** Fills an empty `agency_id`; a value from agency.txt still takes precedence. */
  readonly defaultAgencyId?: string;
  readonly import?: GtfsScheduleImportConfig;
}

export type GtfsScheduleSourceConfig = GtfsScheduleSourceCommon &
  (
    | {
        readonly url: string;
        readonly path?: never;
        readonly requestHeaders?: Readonly<Record<string, string>>;
        /** Download timeout in milliseconds. Defaults to 120000 (2 minutes). */
        readonly timeoutMs?: number;
      }
    | {
        readonly path: string;
        readonly url?: never;
        readonly requestHeaders?: never;
        readonly timeoutMs?: never;
      }
  );

export type GtfsRealtimeFeedType =
  | 'alerts'
  | 'tripUpdates'
  | 'vehiclePositions'
  | 'shapes'
  | 'stops'
  | 'tripModifications'
  | 'mixed';

interface GtfsRealtimeFeedConfigCommon {
  readonly url: string;
  readonly requestHeaders?: Readonly<Record<string, string>>;
  /** Download timeout per attempt in milliseconds. Defaults to 30000 (30 seconds). */
  readonly timeoutMs?: number;
  /** Maximum response bytes after HTTP decompression. Defaults to 64 MiB. */
  readonly maxDownloadBytes?: number;
}

/** One Realtime endpoint, identified explicitly or by its declared type. */
export type GtfsRealtimeFeedConfig = GtfsRealtimeFeedConfigCommon &
  (
    | {
        readonly type: GtfsRealtimeFeedType;
        readonly feedId?: string;
      }
    | {
        /** Stable identity for this endpoint within its owning source. */
        readonly feedId: string;
        readonly type?: GtfsRealtimeFeedType;
      }
  );

export interface GtfsRealtimeSourceConfig {
  readonly feeds: readonly GtfsRealtimeFeedConfig[];
}

interface GtfsSourceIdentity {
  /** Required when configuring more than one source; defaults to `"default"` otherwise. */
  readonly sourceId?: string;
}

/** Source scope accepted by a query-only instance without import endpoints. */
export type GtfsInstanceSourceConfig = GtfsSourceIdentity & {
  readonly schedule?: never;
  readonly realtime?: never;
};

export type GtfsSourceConfig = GtfsSourceIdentity &
  (
    | {
        readonly schedule: GtfsScheduleSourceConfig;
        readonly realtime?: GtfsRealtimeSourceConfig;
      }
    | {
        readonly schedule?: GtfsScheduleSourceConfig;
        readonly realtime: GtfsRealtimeSourceConfig;
      }
  );

export type GtfsScheduleImportSourceConfig = GtfsSourceIdentity & {
  readonly schedule: GtfsScheduleSourceConfig;
  readonly realtime?: GtfsRealtimeSourceConfig;
};

export type GtfsRealtimeRefreshSourceConfig = GtfsSourceIdentity & {
  readonly schedule?: GtfsScheduleSourceConfig;
  readonly realtime: GtfsRealtimeSourceConfig;
};

export interface GtfsRealtimeRetentionConfig {
  /** Non-negative safe integer in seconds. Defaults to 30; 0 expires immediately. */
  readonly currentEntitiesSeconds?: number;
  /** Non-negative safe integer in seconds, or null for unlimited history. Defaults to 86400. */
  readonly snapshotsSeconds?: number | null;
}

export interface GtfsRealtimeConfig {
  readonly retention?: GtfsRealtimeRetentionConfig;
}

export interface GtfsExportConfig {
  readonly outputDirectory?: string;
  /** Replace existing export output only after generation succeeds. Defaults to false. */
  readonly overwrite?: boolean;
  readonly sourceId?: string;
  readonly batchSize?: number;
}

interface GtfsConfigGroups<Database, ReporterValue> {
  readonly database: Database;
  readonly reporting?: GtfsReportingConfig<ReporterValue>;
  readonly extensions?: GtfsImportExtensionSelection;
  readonly sources: readonly GtfsSourceConfig[];
  readonly realtime?: GtfsRealtimeConfig;
  readonly export?: GtfsExportConfig;
}

/** Complete JavaScript configuration, including live client and reporter values. */
export type GtfsConfig<DB = GtfsDatabase> = GtfsConfigGroups<
  GtfsDatabaseConfig<DB>,
  GtfsReporter
>;

/** Complete JSON-file configuration; functions and live clients are forbidden. */
export type GtfsJsonConfig = GtfsConfigGroups<
  GtfsOwnedSqliteDatabaseConfig,
  never
>;

type ConfigGroup<Config, Key extends keyof Config> = Pick<Config, Key>;
type ConfigGroupWithoutSources<
  Config,
  Key extends Exclude<keyof Config, 'sources'>,
> = Pick<Config, Key>;

export type GtfsImportOptions<DB = GtfsDatabase> = ConfigGroupWithoutSources<
  GtfsConfig<DB>,
  'reporting' | 'realtime'
> &
  GtfsImportExtensionOptions & {
    readonly signal?: AbortSignal;
    /** Explicitly use ":memory:" only when the imported data can be discarded on return. */
    readonly database:
      | (GtfsOwnedSqliteDatabaseConfig & { readonly path: string })
      | GtfsBorrowedNativeSqliteDatabaseConfig
      | GtfsBorrowedKyselyDatabaseConfig<DB>;
    readonly sources: readonly GtfsScheduleImportSourceConfig[];
  };

export type GtfsRealtimeRefreshOptions<DB = GtfsDatabase> =
  ConfigGroupWithoutSources<
    GtfsConfig<DB>,
    'database' | 'reporting' | 'realtime'
  > &
    GtfsExtensionOptions & {
      readonly signal?: AbortSignal;
      readonly sources: readonly GtfsRealtimeRefreshSourceConfig[];
    };

export type GtfsExportOptions<DB = GtfsDatabase> = ConfigGroup<
  GtfsConfig<DB>,
  'database' | 'export' | 'reporting'
> &
  GtfsExtensionOptions & { readonly signal?: AbortSignal };
