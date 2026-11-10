import type {
  GtfsBorrowedKyselyDatabaseConfig,
  GtfsBorrowedNativeSqliteDatabaseConfig,
  GtfsConfig,
  GtfsCsvParseOptions,
  GtfsDatabaseConfig,
  GtfsDuplicateKeysPolicy,
  GtfsExistingDataPolicy,
  GtfsExportConfig,
  GtfsExportOptions,
  GtfsImportOptions,
  GtfsInstanceSourceConfig,
  GtfsJsonConfig,
  GtfsJsonValue,
  GtfsOwnedSqliteDatabaseConfig,
  GtfsRealtimeConfig,
  GtfsRealtimeFeedConfig,
  GtfsRealtimeFeedType,
  GtfsRealtimeRetentionConfig,
  GtfsRealtimeSourceConfig,
  GtfsRealtimeRefreshOptions,
  GtfsRealtimeRefreshSourceConfig,
  GtfsReportingConfig,
  GtfsReportingLevel,
  GtfsScheduleArchiveConfig,
  GtfsScheduleImportConfig,
  GtfsScheduleImportSourceConfig,
  GtfsScheduleSourceConfig,
  GtfsScheduleValidationConfig,
  GtfsSourceConfig,
  GtfsSourceErrorsPolicy,
  GtfsUnknownFieldsPolicy,
  GtfsValidationMode,
} from 'gtfs';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type ConfigGroupKeys =
  'database' | 'export' | 'extensions' | 'realtime' | 'reporting' | 'sources';

type _PolicyValuesAreFinal = [
  Assert<Equal<GtfsValidationMode, 'off' | 'strict' | 'permissive'>>,
  Assert<Equal<GtfsUnknownFieldsPolicy, 'reject' | 'preserve' | 'discard'>>,
  Assert<Equal<GtfsDuplicateKeysPolicy, 'reject' | 'keep-first'>>,
  Assert<Equal<GtfsSourceErrorsPolicy, 'abort' | 'continue'>>,
  Assert<Equal<GtfsExistingDataPolicy, 'replace-source' | 'reject'>>,
  Assert<
    Equal<
      GtfsRealtimeFeedType,
      | 'alerts'
      | 'tripUpdates'
      | 'vehiclePositions'
      | 'shapes'
      | 'stops'
      | 'tripModifications'
      | 'mixed'
    >
  >,
  Assert<Equal<GtfsReportingLevel, 'silent' | 'error' | 'warn' | 'info'>>,
];
type _OwnedSqliteKeys = Assert<
  Equal<keyof GtfsOwnedSqliteDatabaseConfig, 'client' | 'durability' | 'path'>
>;
type _NativeSqliteKeys = Assert<
  Equal<
    keyof GtfsBorrowedNativeSqliteDatabaseConfig,
    'client' | 'durability' | 'path'
  >
>;
type _KyselyDatabaseKeys = Assert<
  Equal<
    keyof GtfsBorrowedKyselyDatabaseConfig,
    'client' | 'durability' | 'path'
  >
>;
type _DatabaseUnionKeys = Assert<
  Equal<keyof GtfsDatabaseConfig, 'client' | 'durability' | 'path'>
>;
type _ReportingKeys = Assert<
  Equal<keyof GtfsReportingConfig, 'level' | 'reporter'>
>;
export type CsvOptionContracts = [
  Assert<
    Equal<
      keyof GtfsCsvParseOptions,
      | 'encoding'
      | 'delimiter'
      | 'quote'
      | 'escape'
      | 'trim'
      | 'skipEmptyLines'
      | 'relaxQuotes'
    >
  >,
  Assert<
    Equal<NonNullable<GtfsScheduleImportConfig['csv']>, GtfsCsvParseOptions>
  >,
  Assert<
    Equal<
      GtfsCsvParseOptions['encoding'],
      'utf8' | 'utf16le' | 'latin1' | undefined
    >
  >,
  Assert<Equal<GtfsConfig['sources'], GtfsJsonConfig['sources']>>,
];
const csvParseOptions: GtfsCsvParseOptions = {
  encoding: 'utf16le',
  delimiter: ';',
  quote: false,
  escape: '\\',
  trim: false,
  skipEmptyLines: false,
  relaxQuotes: false,
};
void csvParseOptions;
// @ts-expect-error Supported CSV options are immutable.
csvParseOptions.trim = true;
// @ts-expect-error Only the canonical option spelling is supported.
const snakeCsv: GtfsCsvParseOptions = { skip_empty_lines: true };
// @ts-expect-error CSV values are normalized by node-GTFS, not parser casts.
const castingCsv: GtfsCsvParseOptions = { cast: true };
// @ts-expect-error CSV callbacks are not supported.
const callbackCsv: GtfsCsvParseOptions = { onRecord: () => null };
// @ts-expect-error Record shape is not configurable.
const columnsCsv: GtfsCsvParseOptions = { columns: false };
// @ts-expect-error Raw buffers cannot replace string field values.
const bufferCsv: GtfsCsvParseOptions = { encoding: false };
// @ts-expect-error The quote can be one character or false, not null.
const nullQuoteCsv: GtfsCsvParseOptions = { quote: null };
void [snakeCsv, castingCsv, callbackCsv, columnsCsv, bufferCsv, nullQuoteCsv];
type _ValidationKeys = Assert<
  Equal<
    keyof GtfsScheduleValidationConfig,
    'onDuplicateKey' | 'mode' | 'onUnknownField'
  >
>;
type _ScheduleArchiveKeys = Assert<
  Equal<
    keyof GtfsScheduleArchiveConfig,
    | 'maxCompressedBytes'
    | 'maxEntries'
    | 'maxExtractedFileBytes'
    | 'maxExtractedTotalBytes'
  >
>;
type _ScheduleImportKeys = Assert<
  Equal<
    keyof GtfsScheduleImportConfig,
    'archive' | 'csv' | 'onExistingData' | 'onSourceError' | 'validation'
  >
>;
type _ScheduleSourceKeys = Assert<
  Equal<
    keyof GtfsScheduleSourceConfig,
    | 'defaultAgencyId'
    | 'excludeFiles'
    | 'import'
    | 'path'
    | 'requestHeaders'
    | 'timeoutMs'
    | 'url'
  >
>;
type _RealtimeFeedKeys = Assert<
  Equal<
    keyof GtfsRealtimeFeedConfig,
    | 'feedId'
    | 'maxDownloadBytes'
    | 'requestHeaders'
    | 'timeoutMs'
    | 'type'
    | 'url'
  >
>;
type _TypeIdentifiedRealtimeFeedIsAccepted = Assert<
  { type: 'alerts'; url: string } extends GtfsRealtimeFeedConfig ? true : false
>;
type _ExplicitlyIdentifiedRealtimeFeedIsAccepted = Assert<
  { feedId: string; url: string } extends GtfsRealtimeFeedConfig ? true : false
>;
type _UnidentifiedRealtimeFeedIsRejected = Assert<
  Equal<{ url: string } extends GtfsRealtimeFeedConfig ? true : false, false>
>;
type _RealtimeSourceKeys = Assert<
  Equal<keyof GtfsRealtimeSourceConfig, 'feeds'>
>;
type _InstanceSourceKeys = Assert<
  Equal<keyof GtfsInstanceSourceConfig, 'realtime' | 'schedule' | 'sourceId'>
>;
type _SourceKeys = Assert<
  Equal<keyof GtfsSourceConfig, 'realtime' | 'schedule' | 'sourceId'>
>;
type _SingleScheduleSourceMayOmitSourceId = Assert<
  { schedule: { path: string } } extends GtfsScheduleImportSourceConfig
    ? true
    : false
>;
type _SingleRealtimeSourceMayOmitSourceId = Assert<
  {
    realtime: { feeds: [{ type: 'alerts'; url: string }] };
  } extends GtfsRealtimeRefreshSourceConfig
    ? true
    : false
>;
type _ScheduleImportSourceKeys = Assert<
  Equal<
    keyof GtfsScheduleImportSourceConfig,
    'realtime' | 'schedule' | 'sourceId'
  >
>;
type _RealtimeRefreshSourceKeys = Assert<
  Equal<
    keyof GtfsRealtimeRefreshSourceConfig,
    'realtime' | 'schedule' | 'sourceId'
  >
>;
type _RealtimeRetentionKeys = Assert<
  Equal<
    keyof GtfsRealtimeRetentionConfig,
    'currentEntitiesSeconds' | 'snapshotsSeconds'
  >
>;
type _RealtimeKeys = Assert<Equal<keyof GtfsRealtimeConfig, 'retention'>>;
type _ExportKeys = Assert<
  Equal<
    keyof GtfsExportConfig,
    'batchSize' | 'outputDirectory' | 'overwrite' | 'sourceId'
  >
>;
type _CompleteConfigKeys = Assert<Equal<keyof GtfsConfig, ConfigGroupKeys>>;
type _JsonConfigKeys = Assert<Equal<keyof GtfsJsonConfig, ConfigGroupKeys>>;
type _ImportOptionKeys = Assert<
  Equal<
    keyof GtfsImportOptions,
    'database' | 'extensions' | 'realtime' | 'reporting' | 'sources' | 'signal'
  >
>;
type _ImportDatabaseRequiresAnExplicitDestination = [
  Assert<
    Equal<
      Record<string, never> extends GtfsImportOptions['database']
        ? true
        : false,
      false
    >
  >,
  Assert<
    Equal<
      { path: string } extends GtfsImportOptions['database'] ? true : false,
      true
    >
  >,
  Assert<
    Equal<
      GtfsBorrowedNativeSqliteDatabaseConfig extends GtfsImportOptions['database']
        ? true
        : false,
      true
    >
  >,
  Assert<
    Equal<
      GtfsBorrowedKyselyDatabaseConfig extends GtfsImportOptions['database']
        ? true
        : false,
      true
    >
  >,
  Assert<
    Equal<
      Record<string, never> extends GtfsConfig['database'] ? true : false,
      true
    >
  >,
];
type _RealtimeRefreshOptionKeys = Assert<
  Equal<
    keyof GtfsRealtimeRefreshOptions,
    'database' | 'extensions' | 'realtime' | 'reporting' | 'sources' | 'signal'
  >
>;
type _ExportOptionKeys = Assert<
  Equal<
    keyof GtfsExportOptions,
    'database' | 'export' | 'extensions' | 'reporting' | 'signal'
  >
>;
type _JsonValuesExcludeFunctions = Assert<
  Equal<Extract<GtfsJsonValue, (...arguments_: never[]) => unknown>, never>
>;

export type ConfigTypeAssertions =
  | _PolicyValuesAreFinal
  | _OwnedSqliteKeys
  | _NativeSqliteKeys
  | _KyselyDatabaseKeys
  | _DatabaseUnionKeys
  | _ReportingKeys
  | _ValidationKeys
  | _ScheduleImportKeys
  | _ScheduleSourceKeys
  | _RealtimeFeedKeys
  | _TypeIdentifiedRealtimeFeedIsAccepted
  | _ExplicitlyIdentifiedRealtimeFeedIsAccepted
  | _UnidentifiedRealtimeFeedIsRejected
  | _RealtimeSourceKeys
  | _InstanceSourceKeys
  | _SourceKeys
  | _ScheduleImportSourceKeys
  | _RealtimeRefreshSourceKeys
  | _RealtimeRetentionKeys
  | _RealtimeKeys
  | _ExportKeys
  | _CompleteConfigKeys
  | _JsonConfigKeys
  | _ImportOptionKeys
  | _ImportDatabaseRequiresAnExplicitDestination
  | _RealtimeRefreshOptionKeys
  | _ExportOptionKeys
  | _JsonValuesExcludeFunctions;
