import type { GtfsExtension } from '../schema/define-table.ts';
import type {
  GtfsOwnedSqliteDatabaseConfig,
  GtfsBorrowedNativeSqliteDatabaseConfig,
  GtfsBorrowedKyselyDatabaseConfig,
  GtfsCsvParseOptions,
  GtfsDuplicateKeysPolicy,
  GtfsExistingDataPolicy,
  GtfsRealtimeFeedType,
  GtfsSourceErrorsPolicy,
  GtfsUnknownFieldsPolicy,
  GtfsValidationMode,
} from '../types/config.ts';
import type {
  GtfsReportingConfig,
  GtfsReportingLevel,
} from '../reporting/types.ts';
import type { ConfigValidationContext } from './validation.ts';
import type { ArchiveLimits } from '../io/limits.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';

export type ResolvedGtfsDatabaseConfig<DB = unknown> = Readonly<
  | (GtfsOwnedSqliteDatabaseConfig & { readonly dialect: 'sqlite' })
  | (GtfsBorrowedNativeSqliteDatabaseConfig & { readonly dialect: 'sqlite' })
  | (GtfsBorrowedKyselyDatabaseConfig<DB> & {
      readonly dialect: GtfsDatabaseDialect;
    })
>;

type GtfsConfigOperation = ConfigValidationContext['operation'];

export interface ResolveGtfsConfigOptions {
  readonly format?: ConfigValidationContext['format'];
  readonly operation?: GtfsConfigOperation;
}

export interface ResolvedGtfsScheduleImportConfig {
  readonly archive: ArchiveLimits;
  readonly onSourceError: GtfsSourceErrorsPolicy;
  readonly onExistingData: GtfsExistingDataPolicy;
  readonly csv: Required<GtfsCsvParseOptions>;
  readonly validation: {
    readonly mode: GtfsValidationMode;
    readonly onUnknownField: GtfsUnknownFieldsPolicy;
    readonly onDuplicateKey: GtfsDuplicateKeysPolicy;
  };
}

export type ResolvedGtfsScheduleSourceConfig = Readonly<
  {
    excludeFiles: readonly string[];
    defaultAgencyId?: string;
    import: ResolvedGtfsScheduleImportConfig;
  } & (
    | {
        url: string;
        requestHeaders: Readonly<Record<string, string>>;
        timeoutMs: number;
      }
    | { path: string }
  )
>;

export interface ResolvedGtfsRealtimeFeedConfig {
  readonly maxDownloadBytes: number;
  readonly feedId: string;
  readonly type?: GtfsRealtimeFeedType;
  readonly url: string;
  readonly requestHeaders: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

export interface ResolvedGtfsSourceConfig {
  readonly sourceId: string;
  readonly schedule?: ResolvedGtfsScheduleSourceConfig;
  readonly realtime?: {
    readonly feeds: readonly ResolvedGtfsRealtimeFeedConfig[];
  };
}

export interface ResolvedGtfsConfig<DB = unknown> {
  readonly signal?: AbortSignal;
  readonly database: ResolvedGtfsDatabaseConfig<DB>;
  readonly reporting: GtfsReportingConfig & {
    readonly level: GtfsReportingLevel;
  };
  readonly extensions: readonly GtfsExtension[] | 'auto';
  readonly sources: readonly ResolvedGtfsSourceConfig[];
  readonly realtime: {
    readonly retention: {
      readonly currentEntitiesSeconds: number;
      readonly snapshotsSeconds: number | null;
    };
  };
  readonly export: {
    readonly outputDirectory?: string;
    readonly overwrite: boolean;
    readonly sourceId?: string;
    readonly batchSize: number;
  };
}

export type ResolvedGtfsImportConfig<DB = unknown> = Omit<
  ResolvedGtfsConfig<DB>,
  'sources'
> & {
  readonly sources: readonly (ResolvedGtfsSourceConfig & {
    readonly schedule: ResolvedGtfsScheduleSourceConfig;
  })[];
};

export type ResolvedGtfsRealtimeRefreshConfig<DB = unknown> = Omit<
  ResolvedGtfsConfig<DB>,
  'extensions' | 'sources'
> & {
  readonly extensions: readonly GtfsExtension[];
  readonly sources: readonly (ResolvedGtfsSourceConfig & {
    readonly realtime: {
      readonly feeds: readonly ResolvedGtfsRealtimeFeedConfig[];
    };
  })[];
};

export type ResolvedGtfsExportConfig<DB = unknown> = Omit<
  ResolvedGtfsConfig<DB>,
  'extensions'
> & {
  readonly extensions: readonly GtfsExtension[];
};

export type ResolvedGtfsInstanceConfig<DB = unknown> =
  ResolvedGtfsExportConfig<DB>;
