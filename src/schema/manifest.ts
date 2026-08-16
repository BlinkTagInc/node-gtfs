import { getTableName } from './compile-table.ts';
import { tableDefinitions } from './table-registry.ts';
import type {
  GtfsFieldDefinition,
  GtfsNamespace,
  GtfsPresence,
  GtfsReference,
  GtfsSemanticConstraint,
  GtfsStorageDefinition,
  GtfsTableDefinition,
} from './define-table.ts';

/** GTFS Schedule reference revision used for the standard-table metadata. */
export const gtfsScheduleReferenceRevision = '2026-04-27';

export interface GtfsManifestEntry {
  file: string | null;
  table?: string;
  namespace: GtfsNamespace;
  presence: GtfsPresence;
  primaryKey: readonly string[];
  fields: Readonly<Record<string, GtfsFieldDefinition>>;
  constraints: readonly GtfsSemanticConstraint[];
  storage: GtfsStorageDefinition;
}

export interface GtfsJoinDefinition {
  field: string;
  targetTable: string;
  targetField: string;
}

function toManifestEntry(table: GtfsTableDefinition): GtfsManifestEntry {
  return {
    file: table.file,
    ...(table.file === null ? { table: table.table } : {}),
    namespace: table.namespace,
    presence: table.presence,
    primaryKey: table.primaryKey ?? [],
    fields: table.fields,
    constraints: table.constraints ?? [],
    storage: table.storage ?? {},
  };
}

function buildManifest(): Readonly<Record<string, GtfsManifestEntry>> {
  const manifest: Record<string, GtfsManifestEntry> = {};

  for (const table of tableDefinitions) {
    const tableName = getTableName(table);
    if (manifest[tableName]) {
      throw new Error(`Duplicate GTFS table ${tableName}`);
    }
    manifest[tableName] = toManifestEntry(table);
  }

  return Object.freeze(manifest);
}

/**
 * JSON-serializable structural manifest for documentation, tooling, and
 * conformance snapshots. Semantic validators intentionally live elsewhere.
 */
export const gtfsManifest: Readonly<Record<string, GtfsManifestEntry>> =
  buildManifest();

const manifestEntryByFile = new Map<string, [string, GtfsManifestEntry]>();
for (const entry of Object.entries(gtfsManifest)) {
  const [tableName, definition] = entry;
  if (definition.file === null) continue;
  if (manifestEntryByFile.has(definition.file)) {
    throw new Error(`Duplicate GTFS source file ${definition.file}`);
  }
  manifestEntryByFile.set(definition.file, [tableName, definition]);
}

function resolveJoin(
  sourceTable: string,
  sourceField: string,
  reference: GtfsReference,
): GtfsJoinDefinition | null {
  const targetEntry = manifestEntryByFile.get(reference.file);
  if (!targetEntry) {
    throw new Error(
      `Invalid GTFS reference ${sourceTable}.${sourceField}: source file ${reference.file} is not defined`,
    );
  }

  const [targetTable, target] = targetEntry;
  if (!target.fields[reference.field]) {
    // Structured source files such as locations.geojson expose fields within
    // their contents rather than as queryable SQL columns.
    if (!reference.file.endsWith('.txt')) return null;
    throw new Error(
      `Invalid GTFS reference ${sourceTable}.${sourceField}: ${reference.file}.${reference.field} is not defined`,
    );
  }

  return {
    field: sourceField,
    targetTable,
    targetField: reference.field,
  };
}

/** Queryable, advisory join metadata inferred from declared table references. */
export const gtfsJoins: Readonly<
  Record<string, readonly GtfsJoinDefinition[]>
> = Object.freeze(
  Object.fromEntries(
    Object.entries(gtfsManifest).map(([tableName, table]) => [
      tableName,
      Object.entries(table.fields).flatMap(([field, definition]) =>
        (definition.references ?? []).flatMap((reference) => {
          const join = resolveJoin(tableName, field, reference);
          return join === null ? [] : [join];
        }),
      ),
    ]),
  ),
);
