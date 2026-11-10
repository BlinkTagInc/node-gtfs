import { deepFreeze } from './freeze-metadata.ts';
import { getServiceDaySecondsFieldName } from './compile-table.ts';
import { tableDefinitions } from './table-registry.ts';
import type { GtfsDatabase } from './database.ts';
import type {
  GtfsFieldDefinition,
  GtfsSpecification,
  GtfsPresence,
  GtfsKeyStrategy,
  GtfsReference,
  GtfsSemanticConstraint,
  GtfsTableDefinition,
  GtfsDerivedFieldDefinition,
} from './define-table.ts';

/** GTFS Schedule reference revision used for the standard-table metadata. */
export const gtfsScheduleReferenceRevision = '2026-09-16';

export interface GtfsManifestEntry {
  readonly filename: string | null;
  readonly tableName: string;
  readonly specification: GtfsSpecification;
  readonly presence: GtfsPresence;
  /** Fields identified as the primary key by the governing specification. */
  readonly primaryKey: readonly string[];
  /** Effective node-GTFS identity, including source provenance. */
  readonly storageKey: readonly string[] | null;
  /** Portable strategy used to enforce `storageKey`. */
  readonly keyStrategy: GtfsKeyStrategy;
  readonly fields: Readonly<Record<string, GtfsFieldDefinition>>;
  /** Fields accepted from the source file or protobuf object. */
  readonly inputFields: readonly string[];
  /** Stored fields derived by node-gtfs rather than read from the source. */
  readonly derivedFields: Readonly<Record<string, GtfsDerivedFieldDefinition>>;
  /** Stable projection used when a public query omits `select`. */
  readonly defaultSelectedFields: readonly string[];
  readonly constraints: readonly GtfsSemanticConstraint[];
  /** Query indexes generated for managed databases. */
  readonly indexes: readonly (string | readonly string[])[];
}

export interface GtfsJoinDefinition {
  readonly sourceField: string;
  readonly targetTableName: string;
  readonly targetField: string;
}

type GtfsTableName = Extract<keyof GtfsDatabase, string>;
type GtfsManifest = Readonly<Record<GtfsTableName, GtfsManifestEntry>>;

function toManifestEntry(table: GtfsTableDefinition): GtfsManifestEntry {
  const inputFields = Object.keys(table.fields);
  const derivedEntries = Object.entries(table.fields).flatMap(
    ([fieldName, field]) => {
      if (field.kind !== 'time') {
        return [];
      }
      return [
        [
          getServiceDaySecondsFieldName(fieldName),
          {
            kind: 'integer',
            sourceField: fieldName,
            expression: 'service-day-seconds',
            selectedByDefault: false,
          } satisfies GtfsDerivedFieldDefinition,
        ] as const,
      ];
    },
  );
  const publicNames = new Set(['source_id', ...inputFields]);
  for (const [derivedName] of derivedEntries) {
    if (publicNames.has(derivedName)) {
      throw new Error(
        `Derived public field ${derivedName} collides in ${table.tableName}`,
      );
    }
    publicNames.add(derivedName);
  }
  const derivedFields = Object.fromEntries(derivedEntries);

  return deepFreeze({
    filename: table.filename,
    tableName: table.tableName,
    specification: table.specification,
    presence: table.presence,
    primaryKey: table.primaryKey,
    storageKey: table.storageKey,
    keyStrategy: table.keyStrategy,
    fields: table.fields,
    inputFields,
    derivedFields,
    defaultSelectedFields: ['source_id', ...inputFields],
    constraints: table.constraints ?? [],
    indexes: table.indexes ?? [],
  });
}

function buildGtfsManifest(
  definitions: readonly GtfsTableDefinition[] = tableDefinitions,
): GtfsManifest {
  const manifest: Record<string, GtfsManifestEntry> = {};

  for (const table of definitions) {
    const tableName = table.tableName;
    if (manifest[tableName]) {
      throw new Error(`Duplicate GTFS table ${tableName}`);
    }
    manifest[tableName] = toManifestEntry(table);
  }

  return deepFreeze(manifest) as GtfsManifest;
}

/**
 * JSON-serializable structural manifest for documentation, tooling, and
 * conformance snapshots. Semantic validators intentionally live elsewhere.
 */
export const gtfsManifest = buildGtfsManifest();

const manifestEntryByFilename = new Map<string, [string, GtfsManifestEntry]>();
for (const entry of Object.entries(gtfsManifest)) {
  const [tableName, definition] = entry;
  if (definition.filename === null) {
    continue;
  }
  if (manifestEntryByFilename.has(definition.filename)) {
    throw new Error(`Duplicate GTFS source file ${definition.filename}`);
  }
  manifestEntryByFilename.set(definition.filename, [tableName, definition]);
}

function resolveJoin(
  sourceTable: string,
  sourceField: string,
  reference: GtfsReference,
): GtfsJoinDefinition | null {
  if (
    reference.relationship === 'conditional' ||
    reference.relationship === 'polymorphic'
  ) {
    return null;
  }

  const targetEntry = manifestEntryByFilename.get(reference.targetFilename);
  if (!targetEntry) {
    throw new Error(
      `Invalid GTFS reference ${sourceTable}.${sourceField}: target file ${reference.targetFilename} is not defined`,
    );
  }

  const [targetTableName, target] = targetEntry;
  if (!target.fields[reference.targetField]) {
    throw new Error(
      `Invalid GTFS reference ${sourceTable}.${sourceField}: ${reference.targetFilename}.${reference.targetField} is not defined`,
    );
  }

  return {
    sourceField,
    targetTableName,
    targetField: reference.targetField,
  };
}

/** Queryable, advisory join metadata inferred from declared table references. */
export const gtfsJoins: Readonly<
  Record<GtfsTableName, readonly GtfsJoinDefinition[]>
> = deepFreeze(
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
  ) as unknown as Record<GtfsTableName, readonly GtfsJoinDefinition[]>,
);
