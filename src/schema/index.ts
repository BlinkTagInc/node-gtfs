export { defineGtfsTable, gtfsNamespaces } from './define-table.ts';
export type {
  GtfsDatabaseFromTables,
  GtfsEnumerationValue,
  GtfsFieldDefinition,
  GtfsFieldKind,
  GtfsFieldOptions,
  GtfsInsert,
  GtfsNamespace,
  GtfsPresence,
  GtfsQuery,
  GtfsRangeConstraint,
  GtfsReference,
  GtfsRow,
  GtfsSemanticConstraint,
  GtfsStorageDefinition,
  GtfsStoredRow,
  GtfsTableDefinition,
  GtfsTableName,
  GtfsValuePresence,
} from './define-table.ts';
export type { GtfsDatabase } from './database.ts';
export type * from './row-types.ts';
export {
  gtfsJoins,
  gtfsManifest,
  gtfsScheduleReferenceRevision,
} from './manifest.ts';

export * from './tables/index.ts';
export * as tables from './tables/index.ts';
export type { GtfsJoinDefinition, GtfsManifestEntry } from './manifest.ts';
