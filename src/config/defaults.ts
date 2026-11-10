import type {
  GtfsCsvParseOptions,
  GtfsExportConfig,
  GtfsOwnedSqliteDatabaseConfig,
  GtfsRealtimeRetentionConfig,
  GtfsScheduleArchiveConfig,
} from '../types/config.ts';
import type {
  ResolvedGtfsRealtimeFeedConfig,
  ResolvedGtfsScheduleImportConfig,
} from './resolved.ts';
import type { GtfsExtension } from '../schema/define-table.ts';
import type { GtfsReportingLevel } from '../reporting/types.ts';

// Configuration defaults only. Source and feed defaults apply to each configured
// entry; they do not enable a Schedule source or Realtime endpoint themselves.
export const DEFAULT_GTFS_DATABASE_CONFIG = Object.freeze({
  path: ':memory:',
  durability: 'safe',
} satisfies Required<
  Pick<GtfsOwnedSqliteDatabaseConfig, 'path' | 'durability'>
>);

export const DEFAULT_GTFS_EXTENSIONS: readonly GtfsExtension[] = Object.freeze(
  [],
);

export const DEFAULT_GTFS_SOURCE_ID = 'default';

export const DEFAULT_ARCHIVE_LIMITS = Object.freeze({
  maxCompressedBytes: 1024 ** 3,
  maxEntries: 1000,
  maxExtractedFileBytes: 4 * 1024 ** 3,
  maxExtractedTotalBytes: 8 * 1024 ** 3,
} satisfies Required<GtfsScheduleArchiveConfig>);

export const DEFAULT_GTFS_SCHEDULE_CONFIG = Object.freeze({
  excludeFiles: Object.freeze([] as string[]),
  requestHeaders: Object.freeze({} as Record<string, string>),
  timeoutMs: 120_000,
  import: Object.freeze({
    archive: DEFAULT_ARCHIVE_LIMITS,
    csv: Object.freeze({
      encoding: 'utf8',
      delimiter: ',',
      quote: '"',
      escape: '"',
      trim: true,
      skipEmptyLines: true,
      relaxQuotes: true,
    } satisfies Required<GtfsCsvParseOptions>),
    onExistingData: 'replace-source',
    onSourceError: 'abort',
    validation: Object.freeze({
      mode: 'off',
      onDuplicateKey: 'reject',
      onUnknownField: 'preserve',
    }),
  } satisfies ResolvedGtfsScheduleImportConfig),
});

export const DEFAULT_GTFS_REALTIME_FEED_CONFIG = Object.freeze({
  maxDownloadBytes: 64 * 1024 ** 2,
  requestHeaders: Object.freeze({} as Record<string, string>),
  timeoutMs: 30_000,
} satisfies Pick<
  ResolvedGtfsRealtimeFeedConfig,
  'maxDownloadBytes' | 'requestHeaders' | 'timeoutMs'
>);

export const DEFAULT_GTFS_REALTIME_RETENTION_CONFIG = Object.freeze({
  currentEntitiesSeconds: 30,
  snapshotsSeconds: 86_400,
} satisfies Required<GtfsRealtimeRetentionConfig>);

export const DEFAULT_GTFS_EXPORT_CONFIG = Object.freeze({
  batchSize: 1_000,
  overwrite: false,
} satisfies Required<Pick<GtfsExportConfig, 'batchSize' | 'overwrite'>>);

export const DEFAULT_GTFS_REPORTING_LEVELS = Object.freeze({
  withoutReporter: 'silent',
  withReporter: 'info',
} satisfies Record<'withoutReporter' | 'withReporter', GtfsReportingLevel>);
