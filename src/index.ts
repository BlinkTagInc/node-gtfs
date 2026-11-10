export { importGtfs } from './operations.ts';
export { Gtfs } from './instance.ts';
export type {
  GtfsConnectionOwnership,
  GtfsDatabaseAccess,
  GtfsInstanceExportOptions,
  GtfsInstanceOptions,
  GtfsRealtimeOperations,
  GtfsReporting,
  GtfsReportingLogOptions,
  GtfsSchema,
  GtfsStoredTableName,
  GtfsTableMetadata,
  GtfsTableMetadataCollection,
  GtfsWithKyselyOptions,
} from './instance.ts';
export type {
  GtfsGeoJSON,
  GtfsGeoJSONRoutesOptions,
  GtfsGeoJSONShapesOptions,
  GtfsGeoJSONStopsOptions,
  GtfsShapeGeoJSONProperties,
  GtfsStopGeoJSONProperties,
  GtfsRouteGeoJSONProperties,
} from './geojson/types.ts';
export type { GtfsCoordinateBounds } from './schema/repository-query-extensions.ts';
export type * from './types/repository.ts';
export type {
  GtfsPlusRepositories,
  GtfsRealtimePersistenceRepositories,
  GtfsRealtimeRepositories,
  GtfsRepositoryProperties,
  GtfsRideRepositories,
  GtfsScheduleRepositories,
  GtfsToHtmlRepositories,
  TidesRepositories,
  TodsRepositories,
} from './generated/repositories.ts';
export {
  GTFS_SCHEMA_MODES,
  type GtfsColumnTypeIssue,
  type GtfsSchemaInspection,
  type GtfsSchemaLifecycleOptions,
  type GtfsSchemaMode,
  type GtfsTableSchemaIssue,
} from './database/schema-lifecycle.ts';
export {
  SQLITE_DURABILITY_MODES,
  type SqliteDurability,
} from './database/sqlite/durability.ts';
export {
  DEFAULT_GTFS_EXTENSIONS,
  GTFS_SCHEDULE_CORE,
} from './schema/extensions.ts';
export type {
  GtfsExtension,
  GtfsExtensionOptions,
  GtfsExtensionSelection,
  GtfsImportExtensionOptions,
  GtfsImportExtensionSelection,
} from './schema/extensions.ts';
export { refreshGtfsRealtime } from './operations.ts';
export type {
  GtfsInstanceRealtimeCleanupOptions,
  GtfsRealtimeCleanupResult,
  GtfsRealtimeCleanupTable,
} from './realtime/cleanup.ts';

export { exportGtfs } from './operations.ts';

export {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  isGtfsError,
  formatGtfsError,
} from './diagnostics/errors.ts';
export { createConsoleReporter } from './reporting/reporters.ts';
export type { GtfsConsoleReporterOptions } from './reporting/reporters.ts';
export type {
  GtfsValidationNotice,
  GtfsValidationSeverity,
} from './diagnostics/errors.ts';
export type {
  GtfsImportResult,
  GtfsImportSourceResult,
  GtfsImportFileResult,
} from './schedule/import/result.ts';
export type { GtfsValidationSummary } from './validation/summary.ts';

export type * from './types/index.ts';
export type * from './schema/row-types.ts';

export type * from './types/domain-query.ts';
