import type { Kysely } from 'kysely';
import {
  Gtfs,
  importGtfs,
  exportGtfs,
  type GtfsImportOptions,
  type GtfsExportOptions,
  type GtfsExportResult,
  type GtfsExportFileResult,
} from 'gtfs';
import type {
  GtfsImportResult,
  GtfsInstanceRealtimeCleanupOptions,
  GtfsRealtimeCleanupResult,
} from 'gtfs';

import {
  cleanupGtfsRealtime,
  createKyselyGtfsIndexes,
  createKyselyGtfsTables,
  inspectKyselyGtfsSchema,
  type GtfsKyselySchemaOptions,
  type GtfsRealtimeCleanupOptions,
} from 'gtfs/kysely';
import {
  closeSqliteDatabase,
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
  deleteSqliteDatabase,
  inspectSqliteGtfsSchema,
  openSqliteDatabase,
  type GtfsSchemaInspection,
  type GtfsSchemaLifecycleOptions,
  type GtfsSqliteSchemaOptions,
} from 'gtfs/sqlite';
import type { GtfsDatabase } from 'gtfs/schema';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

declare const database: Kysely<GtfsDatabase>;
declare const importOptions: GtfsImportOptions;
declare const exportOptions: GtfsExportOptions;
declare const schemaOptions: GtfsKyselySchemaOptions<GtfsDatabase>;
declare const sqliteSchemaOptions: GtfsSqliteSchemaOptions;

const importResult = importGtfs(importOptions);
const exportResult = exportGtfs(exportOptions);
declare const gtfs: Gtfs;
const instanceExportResult = gtfs.export();
const tableResult = createKyselyGtfsTables(schemaOptions);
const indexResult = createKyselyGtfsIndexes(schemaOptions);
const inspectionResult = inspectKyselyGtfsSchema({
  database,
  dialect: 'sqlite',
});
const sqliteResult = openSqliteDatabase({ path: ':memory:' });
const sqliteTableResult = createSqliteGtfsTables(sqliteSchemaOptions);
const sqliteInspectionResult = inspectSqliteGtfsSchema({
  database: sqliteResult,
});
const cleanupOptions: GtfsRealtimeCleanupOptions = {
  database,
  extensions: ['gtfs-realtime'],
};
const cleanupResult = cleanupGtfsRealtime(cleanupOptions);
declare const customDatabase: Kysely<{ custom: { id: number } }>;
const customCleanupOptions: GtfsRealtimeCleanupOptions<{
  custom: { id: number };
}> = {
  database: customDatabase,
  extensions: ['gtfs-realtime'],
};
void cleanupGtfsRealtime(customCleanupOptions);
// @ts-expect-error Low-level inspectors require one named options object.
inspectSqliteGtfsSchema(sqliteResult, {});
// @ts-expect-error Low-level inspectors require one named options object.
inspectKyselyGtfsSchema(database, { dialect: 'sqlite' });
// @ts-expect-error Low-level cleanup requires one named options object.
cleanupGtfsRealtime(database, { extensions: ['gtfs-realtime'] });
// @ts-expect-error A caller-owned database is required for inspection.
inspectSqliteGtfsSchema({});
// @ts-expect-error A caller-owned database is required for inspection.
inspectKyselyGtfsSchema({ dialect: 'sqlite' });
// @ts-expect-error A caller-owned database is required for cleanup.
cleanupGtfsRealtime({ extensions: ['gtfs-realtime'] });
// @ts-expect-error Public inspection does not accept a manifest table subset.
inspectSqliteGtfsSchema({ database: sqliteResult, tables: [] });
inspectKyselyGtfsSchema({
  database,
  dialect: 'sqlite',
  // @ts-expect-error Public inspection does not accept a manifest table subset.
  tables: [],
});
type _ImportIsAsync = Assert<
  Equal<typeof importResult, Promise<GtfsImportResult>>
>;
type _ExportIsAsync = Assert<
  Equal<typeof exportResult, Promise<GtfsExportResult>>
>;
type _InstanceExportIsAsync = Assert<
  Equal<typeof instanceExportResult, Promise<GtfsExportResult>>
>;
type _ExportFilesAreReadonly = Assert<
  Equal<GtfsExportResult['files'], readonly GtfsExportFileResult[]>
>;
type _ExportResultKeys = Assert<
  Equal<
    keyof GtfsExportResult,
    'sourceId' | 'outputDirectory' | 'files' | 'durationMs'
  >
>;
type _ExportFileResultKeys = Assert<
  Equal<keyof GtfsExportFileResult, 'filename' | 'recordCount'>
>;
declare const exported: GtfsExportResult;
// @ts-expect-error Export result attributes are readonly.
exported.outputDirectory = './elsewhere';
// @ts-expect-error The exported file list is readonly.
exported.files.push({ filename: 'routes.txt', recordCount: 1 });
declare const exportedFile: GtfsExportFileResult;
// @ts-expect-error File result attributes are readonly.
exportedFile.recordCount = 1;
type _TablesReturnInspection = Assert<
  Equal<typeof tableResult, Promise<GtfsSchemaInspection>>
>;
type _IndexesReturnInspection = Assert<
  Equal<typeof indexResult, Promise<GtfsSchemaInspection>>
>;
type _InspectorReturnsInspection = Assert<
  Equal<typeof inspectionResult, Promise<GtfsSchemaInspection>>
>;
type _SqliteInspectorReturnsInspection = Assert<
  Equal<typeof sqliteInspectionResult, GtfsSchemaInspection>
>;
type _CleanupReturnsResult = Assert<
  Equal<typeof cleanupResult, Promise<GtfsRealtimeCleanupResult>>
>;
type _SqliteInspectorTakesOneArgument = Assert<
  Equal<Parameters<typeof inspectSqliteGtfsSchema>['length'], 1>
>;
type _KyselyInspectorTakesOneArgument = Assert<
  Equal<Parameters<typeof inspectKyselyGtfsSchema>['length'], 1>
>;
type _CleanupTakesOneArgument = Assert<
  Equal<Parameters<typeof cleanupGtfsRealtime>['length'], 1>
>;
type _InstanceCleanupDoesNotAcceptDatabase = Assert<
  Equal<Extract<keyof GtfsInstanceRealtimeCleanupOptions, 'database'>, never>
>;
type PublicInspectionOptionKey = 'database' | 'includeIndexes' | 'extensions';
type _SqliteInspectorOptionKeys = Assert<
  Equal<
    keyof Parameters<typeof inspectSqliteGtfsSchema>[0],
    PublicInspectionOptionKey
  >
>;
type _KyselyInspectorOptionKeys = Assert<
  Equal<
    keyof Parameters<typeof inspectKyselyGtfsSchema>[0],
    PublicInspectionOptionKey | 'dialect'
  >
>;
type _SqliteTablesReturnInspection = Assert<
  Equal<typeof sqliteTableResult, GtfsSchemaInspection>
>;
type _SqliteLifecycleTypeIsPublic = Assert<
  Equal<
    NonNullable<GtfsSchemaLifecycleOptions['mode']>,
    'ensure' | 'validate' | 'recreate'
  >
>;

void [
  closeSqliteDatabase,
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
  deleteSqliteDatabase,
  inspectSqliteGtfsSchema,
  openSqliteDatabase,
  sqliteResult,
];

// @ts-expect-error Storage-plan inspection is private.
import { inspectSqliteGtfsStoragePlan } from 'gtfs/sqlite';
// @ts-expect-error Storage-plan inspection is private.
import { inspectKyselyGtfsStoragePlan } from 'gtfs/kysely';

void [inspectSqliteGtfsStoragePlan, inspectKyselyGtfsStoragePlan];
