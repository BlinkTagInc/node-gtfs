import type {
  GtfsJoinDefinition,
  GtfsManifestEntry,
  GtfsReference,
  GtfsSpecification,
  routes as schemaRoutes,
  tables,
} from 'gtfs/schema';
import {
  createConsoleReporter as publicCreateConsoleReporter,
  exportGtfs as publicExportGtfs,
  Gtfs as PublicGtfs,
  importGtfs as publicImportGtfs,
  refreshGtfsRealtime as publicRefreshGtfsRealtime,
  type GtfsCoordinateBounds,
  type GtfsStopGeoJSONProperties,
  type GtfsShapeGeoJSONProperties,
  type GtfsRouteGeoJSONProperties,
  type GtfsDatabaseAccess,
  type GtfsExtension,
  type GtfsExtensionSelection,
  type GtfsImportExtensionSelection,
  type GtfsImportResult,
  type GtfsExportResult,
  type GtfsInstanceOptions,
  type GtfsRealtimeRefreshOptions,
  type GtfsRealtimeRefreshSourceConfig,
  type RealtimeFeed,
  type RealtimeFeedEntity,
  type GtfsRealtimeCleanupResult,
  type GtfsSchemaInspection,
  type GtfsSchema,
  type GtfsReporting,
  type GtfsOperationName,
  type GtfsReporter,
  type GtfsReportedError,
  type GtfsConsoleReporterOptions,
  type GtfsLogMessageLevel,
  type Routes,
  type StopTimes,
} from 'gtfs';
import type { GtfsRealtimeCleanupOptions } from 'gtfs/kysely';
import type {
  CompiledGtfsColumn,
  CompiledGtfsTable,
} from '../../src/schema/compile-table.ts';
import type {
  Agency,
  BoardAlight,
  CalendarAttributes,
  Deadheads,
  Devices,
  GtfsDatabase,
  GtfsDefaultRow,
  GtfsEnumerationValue,
  GtfsFieldDefinition,
  GtfsInsertRow,
  GtfsStoredRowFilter,
  GtfsNormalizedRow,
  GtfsStoredRow,
  GtfsStoredTableRow,
  RealtimeShape,
  RealtimeStop,
  RealtimeTripModifications,
  RealtimeVehiclePosition,
  Timetables,
} from '../../src/schema/index.ts';
import type {
  GtfsFileBackedTableName,
  GtfsFileBackedFilename,
  GtfsScheduleTableName,
} from '../../src/schema/database.ts';
import type { fareAttributes } from '../../src/schema/tables/gtfs-schedule/fare-attributes.ts';
import type { frequencies } from '../../src/schema/tables/gtfs-schedule/frequencies.ts';
import type { stopTimes } from '../../src/schema/tables/gtfs-schedule/stop-times.ts';
import type { vehiclePositions } from '../../src/schema/tables/gtfs-realtime/vehicle-positions.ts';
import type {
  GtfsConfig,
  GtfsExportOptions,
  GtfsImportOptions,
  GtfsJsonConfig,
  GtfsJsonValue,
  GtfsScheduleSourceConfig,
  GtfsSourceConfig,
  GtfsReportingLevel,
  GtfsReportEvent,
  GtfsReportingConfig,
  GtfsSortDirection,
  SqliteDurability,
} from '../../src/types/index.ts';
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;
export type CaseInsensitiveCapabilityContracts = [
  Assert<
    Equal<
      GtfsFieldDefinition['supportsCaseInsensitiveComparison'],
      boolean | undefined
    >
  >,
  Assert<
    Equal<
      typeof schemaRoutes.fields.route_short_name.supportsCaseInsensitiveComparison,
      true
    >
  >,
];
export type InstanceOperationGroupContracts = [
  Assert<Equal<PublicGtfs['database'], Readonly<GtfsDatabaseAccess>>>,
  Assert<Equal<PublicGtfs['schema'], Readonly<GtfsSchema>>>,
  Assert<Equal<PublicGtfs['reporting'], Readonly<GtfsReporting>>>,
  Assert<
    Equal<
      PublicGtfs<{
        custom: {
          id: string;
        };
      }>['database'],
      Readonly<
        GtfsDatabaseAccess<{
          custom: {
            id: string;
          };
        }>
      >
    >
  >,
];
export type CanonicalReportingContracts = [
  Assert<Equal<NonNullable<GtfsConfig['reporting']>, GtfsReportingConfig>>,
  Assert<
    Equal<NonNullable<GtfsImportOptions['reporting']>, GtfsReportingConfig>
  >,
  Assert<
    Equal<NonNullable<GtfsExportOptions['reporting']>, GtfsReportingConfig>
  >,
  Assert<
    Equal<
      NonNullable<GtfsRealtimeRefreshOptions['reporting']>,
      GtfsReportingConfig
    >
  >,
  Assert<
    Equal<
      NonNullable<GtfsRealtimeCleanupOptions['reporting']>,
      GtfsReportingConfig
    >
  >,
  Assert<
    Equal<NonNullable<GtfsJsonConfig['reporting']>, GtfsReportingConfig<never>>
  >,
  Assert<Equal<Parameters<GtfsReporter>, [GtfsReportEvent]>>,
  Assert<Equal<ReturnType<typeof publicCreateConsoleReporter>, GtfsReporter>>,
  Assert<
    Equal<
      NonNullable<Parameters<typeof publicCreateConsoleReporter>[0]>,
      GtfsConsoleReporterOptions
    >
  >,
  Assert<Equal<GtfsReportEvent['level'], GtfsLogMessageLevel>>,
  Assert<
    Equal<
      Extract<
        GtfsReportEvent,
        {
          type: 'message';
        }
      >['error'],
      GtfsReportedError | undefined
    >
  >,
  Assert<Equal<GtfsLogMessageLevel, 'error' | 'warn' | 'info'>>,
];
export type RealtimeRefreshOptionNames = [
  GtfsRealtimeRefreshOptions,
  GtfsRealtimeRefreshSourceConfig,
];
export type InstanceOperationOptions = [
  Assert<
    Equal<
      Parameters<PublicGtfs['import']>,
      [import('gtfs').GtfsInstanceImportOptions]
    >
  >,
  Assert<
    Equal<
      Parameters<PublicGtfs['realtime']['refresh']>,
      [import('gtfs').GtfsInstanceRealtimeRefreshOptions]
    >
  >,
];
export type RealtimeFeedMatchesStoredTable = Assert<
  Equal<RealtimeFeed, GtfsDatabase['realtime_feeds']>
>;
export type RealtimeFeedEntityMatchesStoredTable = Assert<
  Equal<RealtimeFeedEntity, GtfsDatabase['realtime_feed_entities']>
>;
export type InspectionHasOnlyIssueList = Assert<
  Equal<keyof GtfsSchemaInspection, 'compatible' | 'tableIssues'>
>;
export type JoinHasTargetTableName = Assert<
  Equal<
    keyof GtfsJoinDefinition,
    'sourceField' | 'targetTableName' | 'targetField'
  >
>;
export type CompiledTableKeepsTableName = Assert<
  Equal<CompiledGtfsTable['tableName'], string>
>;
export type CompiledColumnKeepsMinimum = Assert<
  Equal<CompiledGtfsColumn['minimum'], number | undefined>
>;
export type CompiledColumnKeepsMaximum = Assert<
  Equal<CompiledGtfsColumn['maximum'], number | undefined>
>;
type IsReadonlyKey<Type, Key extends keyof Type> = Equal<
  Pick<Type, Key>,
  Readonly<Pick<Type, Key>>
>;
export type StoredMoneyHasDriverRepresentations = Assert<
  Equal<
    GtfsStoredTableRow<'fare_attributes'>['price'],
    number | bigint | string
  >
>;
export type StoredFareProductAmountHasDriverRepresentations = Assert<
  Equal<GtfsDatabase['fare_products']['amount'], number | bigint | string>
>;
export type PublicMoneyRemainsDecimalText = Assert<
  Equal<GtfsDefaultRow<typeof fareAttributes>['price'], string>
>;
export type NormalizedMoneyRemainsDecimalText = Assert<
  Equal<GtfsNormalizedRow<typeof fareAttributes>['price'], string>
>;
type Frequency = GtfsNormalizedRow<typeof frequencies>;
type StoredFrequency = GtfsStoredRow<typeof frequencies>;
type StoredStopTime = GtfsStoredRow<typeof stopTimes>;
type FrequencyInsert = GtfsInsertRow<typeof frequencies>;
type FrequencyQuery = GtfsStoredRowFilter<typeof frequencies>;
type NormalizedVehiclePosition = GtfsNormalizedRow<typeof vehiclePositions>;
type EnumerationField = Extract<
  GtfsFieldDefinition,
  {
    kind: 'enumeration';
  }
>;
type ScalarField = Exclude<
  GtfsFieldDefinition,
  {
    kind: 'enumeration';
  }
>;
type _SchemaSubpathExportsTables = Assert<
  Equal<typeof schemaRoutes.filename, 'routes.txt'>
>;
type _SchemaSubpathExportsTableName = Assert<
  Equal<typeof schemaRoutes.tableName, 'routes'>
>;
type _SchemaSubpathExportsSpecification = Assert<
  Equal<typeof schemaRoutes.specification, 'gtfs-schedule'>
>;
type _SpecificationIncludesCoreAndExtensions = Assert<
  Equal<
    GtfsSpecification,
    | 'gtfs-schedule'
    | 'gtfs-realtime'
    | 'gtfs-plus'
    | 'gtfs-ride'
    | 'gtfs-to-html'
    | 'tods'
    | 'tods-v1'
    | 'tides'
  >
>;
type _ExtensionSelectionIsAnExplicitList = Assert<
  Equal<GtfsExtensionSelection, readonly GtfsExtension[]>
>;
type _ImportSelectionAlsoAllowsDetection = Assert<
  Equal<GtfsImportExtensionSelection, readonly GtfsExtension[] | 'auto'>
>;
export type OperationExtensionContracts = [
  Assert<
    Equal<GtfsInstanceOptions['extensions'], GtfsExtensionSelection | undefined>
  >,
  Assert<
    Equal<GtfsExportOptions['extensions'], GtfsExtensionSelection | undefined>
  >,
  Assert<
    Equal<
      GtfsRealtimeRefreshOptions['extensions'],
      GtfsExtensionSelection | undefined
    >
  >,
  Assert<
    Equal<
      GtfsRealtimeCleanupOptions['extensions'],
      GtfsExtensionSelection | undefined
    >
  >,
  Assert<
    Equal<
      GtfsImportOptions['extensions'],
      GtfsImportExtensionSelection | undefined
    >
  >,
];
const autoImportConfig = {
  database: { path: ':memory:' },
  extensions: 'auto',
  sources: [
    {
      schedule: { path: './feed.zip' },
      realtime: {
        feeds: [{ type: 'alerts', url: 'https://example.test/alerts.pb' }],
      },
    },
  ],
} as const;
publicImportGtfs(autoImportConfig);
declare const importExtensionSelection: GtfsImportExtensionSelection;
publicImportGtfs({ ...autoImportConfig, extensions: importExtensionSelection });
// @ts-expect-error Instances require an explicit extension list, even with Schedule sources.
new PublicGtfs(autoImportConfig);
// @ts-expect-error Export cannot detect extensions from Schedule files.
publicExportGtfs(autoImportConfig);
// @ts-expect-error Realtime refresh cannot detect extensions from Schedule files.
publicRefreshGtfsRealtime(autoImportConfig);
const explicitExtensionConfig = {
  ...autoImportConfig,
  extensions: ['gtfs-realtime'],
} as const;
new PublicGtfs(explicitExtensionConfig);
publicImportGtfs(explicitExtensionConfig);
publicExportGtfs(explicitExtensionConfig);
publicRefreshGtfsRealtime(explicitExtensionConfig);
type _ManifestUsesFinalMetadataNames = Assert<
  Equal<
    Extract<
      keyof GtfsManifestEntry,
      | 'filename'
      | 'tableName'
      | 'specification'
      | 'primaryKey'
      | 'storageKey'
      | 'keyStrategy'
      | 'indexes'
    >,
    | 'filename'
    | 'tableName'
    | 'specification'
    | 'primaryKey'
    | 'storageKey'
    | 'keyStrategy'
    | 'indexes'
  >
>;
type _JoinUsesSourceField = Assert<
  Equal<Extract<keyof GtfsJoinDefinition, 'sourceField'>, 'sourceField'>
>;
type _ReferenceUsesTargetNames = Assert<
  Equal<
    Extract<keyof GtfsReference, 'targetFilename' | 'targetField'>,
    'targetFilename' | 'targetField'
  >
>;
type _TripIdIsRequiredString = Assert<Equal<Frequency['trip_id'], string>>;
type _ExactTimesIsInteger = Assert<
  Equal<Frequency['exact_times'], number | null>
>;
type _RealtimeEnumerationAcceptsKnownValue = Assert<
  'STOPPED_AT' extends NonNullable<NormalizedVehiclePosition['current_status']>
    ? true
    : false
>;
type _RealtimeEnumerationAcceptsFutureValue = Assert<
  'FUTURE_STATUS' extends NonNullable<
    NormalizedVehiclePosition['current_status']
  >
    ? true
    : false
>;
type _ClosedEnumerationRejectsFutureValue = Assert<
  Equal<
    Extract<'FUTURE_STATUS', GtfsEnumerationValue<'STOPPED_AT', true>>,
    never
  >
>;
type _StartServiceDaySecondsIsGenerated = Assert<
  Equal<StoredFrequency['start_service_day_seconds'], number>
>;
type _EndPickupDropOffWindowServiceDaySecondsIsGenerated = Assert<
  Equal<
    StoredStopTime['end_pickup_drop_off_window_service_day_seconds'],
    number | null
  >
>;
type _DatabaseUsesTableName = Assert<
  Equal<GtfsDatabase['frequencies'], StoredFrequency>
>;
type _InsertRequiresTripId = Assert<
  Equal<
    Pick<FrequencyInsert, 'trip_id'>,
    {
      trip_id: string;
    }
  >
>;
type _QueryAcceptsInValues = Assert<
  readonly string[] extends NonNullable<FrequencyQuery['trip_id']>
    ? true
    : false
>;
type _EnumerationRequiresValues = Assert<
  Equal<
    EnumerationField['values'],
    readonly [string | number, ...(string | number)[]]
  >
>;
type _ScalarForbidsValues = Assert<Equal<ScalarField['values'], undefined>>;
type _FileBackedNamesIncludeFareLegJoinRules = Assert<
  'fare_leg_join_rules' extends GtfsFileBackedTableName ? true : false
>;
type _FileBackedNamesIncludeExtensions = Assert<
  'timetables' extends GtfsFileBackedTableName ? true : false
>;
type _FileBackedNamesExcludeRealtimeTables = Assert<
  Equal<Extract<GtfsFileBackedTableName, 'trip_updates'>, never>
>;
type _FileBackedFilenamesIncludeLocations = Assert<
  'locations.geojson' extends GtfsFileBackedFilename ? true : false
>;
type _FileBackedFilenamesIncludeCsvExtensions = Assert<
  'vehicles.csv' extends GtfsFileBackedFilename ? true : false
>;
type _FileBackedFilenamesRejectTableNames = Assert<
  Equal<Extract<GtfsFileBackedFilename, 'shapes'>, never>
>;
type _ScheduleNamesRemainAvailable = Assert<
  'agency' extends GtfsScheduleTableName ? true : false
>;
type _SqliteDurabilityModesArePublic = Assert<
  Equal<SqliteDurability, 'safe' | 'unsafe-bulk'>
>;
type _SortDirectionsAreLowercase = Assert<
  Equal<GtfsSortDirection, 'asc' | 'desc'>
>;
type _ScheduleImportsReturnResults = Assert<
  Equal<Awaited<ReturnType<typeof publicImportGtfs>>, GtfsImportResult>
>;
type _RealtimeImportsReturnResults = Assert<
  Equal<Awaited<ReturnType<typeof publicRefreshGtfsRealtime>>, GtfsImportResult>
>;
const publicGtfs = new PublicGtfs({ database: {} });
type PublicGtfsInstance = typeof publicGtfs;
type _RepositoryNamespacesAreDiscoverable = Assert<
  Equal<
    Extract<
      keyof PublicGtfsInstance,
      | 'schedule'
      | 'realtime'
      | 'gtfsPlus'
      | 'gtfsRide'
      | 'gtfsToHtml'
      | 'tods'
      | 'tides'
    >,
    | 'schedule'
    | 'realtime'
    | 'gtfsPlus'
    | 'gtfsRide'
    | 'gtfsToHtml'
    | 'tods'
    | 'tides'
  >
>;
type _InstanceStringKeysAreExact = Assert<
  Equal<
    Extract<keyof PublicGtfsInstance, string>,
    | 'close'
    | 'database'
    | 'export'
    | 'extensions'
    | 'geojson'
    | 'gtfsPlus'
    | 'gtfsRide'
    | 'gtfsToHtml'
    | 'import'
    | 'isClosed'
    | 'query'
    | 'realtime'
    | 'reporting'
    | 'schedule'
    | 'schema'
    | 'sourceIds'
    | 'tides'
    | 'tods'
    | 'todsV1'
  >
>;
type _InstancePropertyGroupsAreFinal = Assert<
  Equal<
    Extract<
      keyof PublicGtfsInstance,
      'database' | 'schema' | 'reporting' | 'isClosed'
    >,
    'database' | 'schema' | 'reporting' | 'isClosed'
  >
>;
type _DatabaseAccessIsExact = Assert<
  Equal<
    keyof PublicGtfsInstance['database'],
    'dialect' | 'ownership' | 'withKysely'
  >
>;
type _SchemaIsExact = Assert<
  Equal<
    keyof PublicGtfsInstance['schema'],
    'ensure' | 'recreate' | 'tables' | 'validate'
  >
>;
type _ReportingIsExact = Assert<
  Equal<keyof PublicGtfsInstance['reporting'], 'level' | 'log' | 'reporter'>
>;
type _InstanceTableMetadataIsExact = Assert<
  Equal<
    keyof PublicGtfsInstance['schema']['tables']['routes'],
    'filename' | 'specification' | 'tableName'
  >
>;
type _InstanceClosedStateIsBoolean = Assert<
  Equal<PublicGtfsInstance['isClosed'], boolean>
>;
publicGtfs.schema.ensure();
publicGtfs.schema.validate();
publicGtfs.schema.recreate();
type _SchemaMethodsTakeNoArguments = Assert<
  Equal<
    | Parameters<PublicGtfsInstance['schema']['ensure']>
    | Parameters<PublicGtfsInstance['schema']['validate']>
    | Parameters<PublicGtfsInstance['schema']['recreate']>,
    []
  >
>;
publicGtfs.database.withKysely({ callback: async (database) => database });
publicGtfs.reporting.log({ level: 'info', message: 'ready' });
const instanceImportResult = publicGtfs.import();
const instanceExportResult = publicGtfs.export({
  outputDirectory: './gtfs-export',
  batchSize: 500,
});
const realtimeRefreshResult = publicGtfs.realtime.refresh();
const realtimeCleanupResult = publicGtfs.realtime.cleanup({
  nowUnixSeconds: 1,
  currentState: true,
  snapshotHistory: false,
});
const closeResult = publicGtfs.close();
const asyncDisposeResult = publicGtfs[Symbol.asyncDispose]();
type _InstanceImportResultIsStructured = Assert<
  Equal<Awaited<typeof instanceImportResult>, GtfsImportResult>
>;
type _InstanceExportResultIsStructured = Assert<
  Equal<Awaited<typeof instanceExportResult>, GtfsExportResult>
>;
type _InstanceRealtimeRefreshIsStructured = Assert<
  Equal<Awaited<typeof realtimeRefreshResult>, GtfsImportResult>
>;
type _InstanceRealtimeCleanupIsStructured = Assert<
  Equal<Awaited<typeof realtimeCleanupResult>, GtfsRealtimeCleanupResult>
>;
type _InstanceCloseReturnsVoid = Assert<
  Equal<Awaited<typeof closeResult>, void>
>;
type _InstanceAsyncDisposeReturnsVoid = Assert<
  Equal<Awaited<typeof asyncDisposeResult>, void>
>;
void instanceImportResult;
void instanceExportResult;
void realtimeRefreshResult;
void realtimeCleanupResult;
void closeResult;
void asyncDisposeResult;
// @ts-expect-error The database callback must be in a named options object.
publicGtfs.database.withKysely(async (database) => database);
// @ts-expect-error Import policy is configured on the instance.
publicGtfs.import({ extensions: ['gtfs-ride'] });
publicGtfs.import({});
// @ts-expect-error Import does not accept an explicit undefined argument.
publicGtfs.import(undefined);
publicGtfs.export({ sourceId: 'bart' });
publicGtfs.realtime.refresh({ sources: [] });
publicGtfs.realtime.refresh({});
// @ts-expect-error Refresh does not accept an explicit undefined argument.
publicGtfs.realtime.refresh(undefined);
type _StopGeoJSONIdIsRequired = Assert<
  Equal<GtfsStopGeoJSONProperties['stop_id'], string>
>;
type _StopGeoJSONNameIsOptional = Assert<
  Equal<GtfsStopGeoJSONProperties['stop_name'], string | undefined>
>;
type _StopGeoJSONAttributeIsOptional = Assert<
  Equal<GtfsStopGeoJSONProperties['stop_city'], string | undefined>
>;
type _ShapeGeoJSONIdIsRequired = Assert<
  Equal<GtfsShapeGeoJSONProperties['shape_id'], string>
>;
type _NestedGeoJSONRouteType = Assert<
  Equal<
    GtfsStopGeoJSONProperties['routes'][number]['route_type'],
    Routes['route_type']
  >
>;
type _NestedGeoJSONRouteAttribute = Assert<
  Equal<
    GtfsShapeGeoJSONProperties['routes'][number]['category'],
    number | undefined
  >
>;
type _RouteGeoJSONColor = Assert<
  Equal<GtfsRouteGeoJSONProperties['route_color'], `#${string}` | undefined>
>;
// @ts-expect-error Stop coordinates are in the geometry, not properties.
type _StopGeoJSONHasNoLatitude = GtfsStopGeoJSONProperties['stop_lat'];
// @ts-expect-error A shape can serve multiple routes; it has no top-level route_id.
type _ShapeGeoJSONHasNoRouteId = GtfsShapeGeoJSONProperties['route_id'];
// @ts-expect-error GeoJSON properties do not expose arbitrary unknown fields.
type _RouteGeoJSONHasNoUnknownFields = GtfsRouteGeoJSONProperties['bogus'];
// @ts-expect-error GeoJSON properties exclude storage-only fields.
type _NoGeoJSONStorageColumn = GtfsStopGeoJSONProperties['_unknown_fields'];
const publicCoordinateBounds: GtfsCoordinateBounds = {
  south: 37.7,
  west: -122.5,
  north: 37.8,
  east: -122.3,
};
// @ts-expect-error Coordinate-bound inputs are immutable through the public type.
publicCoordinateBounds.south = 0;
type _ScheduleAliasComesFromSchema = Assert<
  Equal<Agency, GtfsDefaultRow<typeof tables.agency>>
>;
type _GtfsToHtmlAliasComesFromSchema = Assert<
  Equal<Timetables, GtfsDefaultRow<typeof tables.timetables>>
>;
type _GtfsPlusAliasComesFromSchema = Assert<
  Equal<CalendarAttributes, GtfsDefaultRow<typeof tables.calendarAttributes>>
>;
type _GtfsRideAliasComesFromSchema = Assert<
  Equal<BoardAlight, GtfsDefaultRow<typeof tables.boardAlight>>
>;
type _RealtimeAliasComesFromSchema = Assert<
  Equal<RealtimeVehiclePosition, GtfsStoredTableRow<'vehicle_positions'>>
>;
type _RealtimeShapeAliasComesFromSchema = Assert<
  Equal<RealtimeShape, GtfsStoredTableRow<'realtime_shapes'>>
>;
type _RealtimeStopAliasComesFromSchema = Assert<
  Equal<RealtimeStop, GtfsStoredTableRow<'realtime_stops'>>
>;
type _RealtimeTripModificationsAliasComesFromSchema = Assert<
  Equal<RealtimeTripModifications, GtfsStoredTableRow<'trip_modifications'>>
>;
type _TodsAliasComesFromSchema = Assert<
  Equal<Deadheads, GtfsDefaultRow<typeof tables.deadheads>>
>;
type _TidesAliasComesFromSchema = Assert<
  Equal<Devices, GtfsDefaultRow<typeof tables.devices>>
>;
export type StopTimesExcludesStorageFields = Assert<
  Equal<
    Extract<
      keyof StopTimes,
      '_unknown_fields' | `${string}_service_day_seconds`
    >,
    never
  >
>;
export type StoredStopTimesKeepsStorageFields = Assert<
  Equal<
    Pick<
      GtfsStoredTableRow<'stop_times'>,
      '_unknown_fields' | 'arrival_service_day_seconds'
    >,
    {
      _unknown_fields: string | null;
      arrival_service_day_seconds: number | null;
    }
  >
>;
declare const defaultStopTime: StopTimes;
// @ts-expect-error A default repository row is not a complete physical row.
const physicalStopTime: GtfsStoredTableRow<'stop_times'> = defaultStopTime;
void physicalStopTime;
type _StaticFeedSourceIsExclusive = Assert<
  Equal<
    {
      url: string;
      path: string;
    } extends GtfsScheduleSourceConfig
      ? true
      : false,
    false
  >
>;
type _LocalScheduleSourceHasNoDownloadOptions = Assert<
  Equal<
    {
      path: string;
      timeoutMs: number;
    } extends GtfsScheduleSourceConfig
      ? true
      : false,
    false
  >
>;
type _ImportPolicyExistsOnlyOnSchedule = Assert<
  Equal<Extract<keyof GtfsImportOptions, 'import'>, never>
>;
type ConfigReporter = Exclude<
  NonNullable<GtfsConfig['reporting']>['reporter'],
  undefined
>;
type _ReporterReceivesOneStructuredEvent = Assert<
  Equal<Parameters<ConfigReporter>, [GtfsReportEvent]>
>;
type _ReportingLevelsUseWarn = Assert<
  Equal<GtfsReportingLevel, 'silent' | 'error' | 'warn' | 'info'>
>;
type _OperationNameIsPublic = Assert<
  Equal<
    GtfsOperationName,
    'cleanup' | 'export' | 'import' | 'realtime' | 'validation'
  >
>;
type _ConfigSourcesAreReadonly = Assert<IsReadonlyKey<GtfsConfig, 'sources'>>;
type _ScheduleSourcePathIsReadonly = Assert<
  IsReadonlyKey<
    Extract<
      GtfsScheduleSourceConfig,
      {
        path: string;
      }
    >,
    'path'
  >
>;
type _ManifestFilenameIsReadonly = Assert<
  IsReadonlyKey<GtfsManifestEntry, 'filename'>
>;
type _ImportResultSuccessIsReadonly = Assert<
  IsReadonlyKey<GtfsImportResult, 'success'>
>;
type _SchemaInspectionTablesAreReadonly = Assert<
  IsReadonlyKey<GtfsSchemaInspection, 'tableIssues'>
>;
declare const readonlyImportResult: GtfsImportResult;
// @ts-expect-error Completed import reports expose readonly collections.
readonlyImportResult.errors.push(new Error());
// @ts-expect-error Completed source collections are readonly.
readonlyImportResult.sources.push({});
// @ts-expect-error File counts are readonly.
readonlyImportResult.sources[0]!.files[0]!.rowsInserted = 0;
// @ts-expect-error Notice samples are readonly.
readonlyImportResult.validation.samples.push({});
// @ts-expect-error Notice counts are readonly.
readonlyImportResult.validation.countsBySeverity.error = 0;
declare const readonlySchemaInspection: GtfsSchemaInspection;
// @ts-expect-error Completed schema inspections expose readonly collections.
readonlySchemaInspection.tableIssues.push({
  tableName: 'agency',
  missingTable: true,
  missingColumns: [],
  unexpectedlyNullableColumns: [],
  missingDefaultColumns: [],
  missingIndexes: [],
  incompatibleColumnTypes: [],
  incompatibleGeneratedColumns: [],
});
declare let mutableAgencyRow: Agency;
mutableAgencyRow.agency_name = 'Updated locally';
type _RealtimeSourceDoesNotRequireSchedule = Assert<
  {
    sourceId: string;
    realtime: {
      feeds: [
        {
          type: 'tripUpdates';
          url: string;
        },
      ];
    };
  } extends GtfsSourceConfig
    ? true
    : false
>;
type _SingleSourceDoesNotRequireSourceId = Assert<
  {
    schedule: {
      path: string;
    };
  } extends GtfsSourceConfig
    ? true
    : false
>;
type _JsonConfigForbidsDatabaseClient = Assert<
  Equal<Exclude<GtfsJsonConfig['database']['client'], undefined>, never>
>;
type _JsonConfigForbidsReporter = Assert<
  Equal<
    Exclude<NonNullable<GtfsJsonConfig['reporting']>['reporter'], undefined>,
    never
  >
>;
type _JsonValuesForbidFunctions = Assert<
  Equal<Extract<GtfsJsonValue, (...arguments_: never[]) => unknown>, never>
>;
type _ScheduleImportRequiresAScheduleSource = Assert<
  Equal<
    {
      database: {
        path: string;
      };
      sources: [
        {
          sourceId: string;
          realtime: {
            feeds: [
              {
                feedId: string;
                url: string;
              },
            ];
          };
        },
      ];
    } extends GtfsImportOptions
      ? true
      : false,
    false
  >
>;
export type SchemaTypeAssertions =
  | _TripIdIsRequiredString
  | _ExactTimesIsInteger
  | _RealtimeEnumerationAcceptsKnownValue
  | _RealtimeEnumerationAcceptsFutureValue
  | _ClosedEnumerationRejectsFutureValue
  | _StartServiceDaySecondsIsGenerated
  | _EndPickupDropOffWindowServiceDaySecondsIsGenerated
  | _DatabaseUsesTableName
  | _InsertRequiresTripId
  | _QueryAcceptsInValues
  | _EnumerationRequiresValues
  | _ScalarForbidsValues
  | _FileBackedNamesIncludeFareLegJoinRules
  | _FileBackedNamesIncludeExtensions
  | _FileBackedNamesExcludeRealtimeTables
  | _ScheduleNamesRemainAvailable
  | _InstancePropertyGroupsAreFinal
  | _DatabaseAccessIsExact
  | _SchemaIsExact
  | _ReportingIsExact
  | _InstanceTableMetadataIsExact
  | _InstanceClosedStateIsBoolean
  | _ScheduleAliasComesFromSchema
  | _GtfsToHtmlAliasComesFromSchema
  | _GtfsPlusAliasComesFromSchema
  | _GtfsRideAliasComesFromSchema
  | _RealtimeAliasComesFromSchema
  | _TodsAliasComesFromSchema
  | _TidesAliasComesFromSchema
  | _StaticFeedSourceIsExclusive
  | _LocalScheduleSourceHasNoDownloadOptions
  | _ImportPolicyExistsOnlyOnSchedule
  | _ReporterReceivesOneStructuredEvent
  | _RealtimeSourceDoesNotRequireSchedule
  | _JsonConfigForbidsDatabaseClient
  | _JsonConfigForbidsReporter
  | _JsonValuesForbidFunctions
  | _ScheduleImportRequiresAScheduleSource;

publicGtfs.import({
  sources: [{ sourceId: 'metro', schedule: { path: './feed.zip' } }],
  validation: { mode: 'strict' },
  reporting: { level: 'silent' },
});
publicGtfs.realtime.refresh({
  sources: [
    {
      sourceId: 'metro',
      realtime: {
        feeds: [{ type: 'alerts', url: 'https://example.test/a.pb' }],
      },
    },
  ],
  retention: { snapshotsSeconds: null },
});
// @ts-expect-error Per-call sources require an explicit identity.
publicGtfs.import({ sources: [{ schedule: { path: './feed.zip' } }] });
// @ts-expect-error Operations cannot replace the instance connection.
publicGtfs.import({ database: { path: './other.sqlite' } });
publicGtfs.import({ signal: new AbortController().signal });
publicGtfs.export({ signal: new AbortController().signal });
publicGtfs.realtime.refresh({ signal: new AbortController().signal });
// @ts-expect-error Cancellation requires a real signal.
publicGtfs.import({ signal: {} });
// @ts-expect-error Signals belong to operation calls, not instance defaults.
new PublicGtfs({ database: {}, signal: new AbortController().signal });
// @ts-expect-error Refresh cannot enable extensions.
publicGtfs.realtime.refresh({ extensions: ['gtfs-realtime'] });
// @ts-expect-error Export cannot replace instance connection ownership.
publicGtfs.export({ database: {} });
