export type GtfsNamespace =
  | 'gtfs-schedule'
  | 'gtfs-realtime'
  | 'gtfs-plus'
  | 'gtfs-ride'
  | 'gtfs-to-html'
  | 'noptis'
  | 'tods'
  | 'tides';

export type GtfsPresence =
  | 'required'
  | 'optional'
  | 'conditionallyRequired'
  | 'conditionallyForbidden'
  | 'recommended';

/** Whether a field value is required in each record. */
export type GtfsValuePresence = GtfsPresence;

export type GtfsFieldKind =
  'id' | 'text' | 'integer' | 'real' | 'date' | 'time' | 'json' | 'enumeration';

/** Reference to a field in another GTFS source file. */
export interface GtfsReference {
  file: string;
  field: string;
}

export interface GtfsFieldOptions {
  /** Whether every record must contain a non-empty value. */
  presence?: GtfsValuePresence;
  /** Alternative GTFS source fields that this value may identify. */
  references?: readonly GtfsReference[];
  /** Apply the configured feed prefix to this field while merging feeds. */
  applyFeedPrefix?: boolean;
  /** Value supplied during normalization when the source value is empty. */
  defaultValue?: string | number | null;
  /** Request case-insensitive database comparison where supported. */
  caseInsensitiveComparison?: boolean;
  /** Dot-separated path used to extract this field from a source object. */
  sourcePath?: string;
  /** Inclusive numeric lower bound. */
  minimum?: number;
  /** Inclusive numeric upper bound. */
  maximum?: number;
}

export type GtfsFieldDefinition =
  | (GtfsFieldOptions & {
      kind: Exclude<GtfsFieldKind, 'enumeration'>;
      values?: never;
    })
  | (GtfsFieldOptions & {
      kind: 'enumeration';
      /** Whether values outside `values` are semantically invalid. Defaults to false. */
      closed?: boolean;
      values: readonly [string | number, ...(string | number)[]];
    });

export interface GtfsRangeConstraint {
  kind: 'range';
  startField: string;
  endField: string;
  allowEqual: boolean;
}

export type GtfsSemanticConstraint = GtfsRangeConstraint;

export interface GtfsStorageDefinition {
  /** Single-column names or ordered composite-index column lists. */
  indexes?: readonly (string | readonly string[])[];
}

type GtfsFields = Record<string, GtfsFieldDefinition>;

interface GtfsTableMetadata<Fields extends GtfsFields> {
  namespace: GtfsNamespace;
  presence: GtfsPresence;
  primaryKey?: readonly Extract<keyof Fields, string>[];
  fields: Fields;
  constraints?: readonly GtfsSemanticConstraint[];
  storage?: GtfsStorageDefinition;
}

export type GtfsTableDefinition<Fields extends GtfsFields = GtfsFields> =
  GtfsTableMetadata<Fields> &
    (
      | {
          /** Static GTFS source filename, including its extension. */
          file: string;
          table?: never;
        }
      | {
          /** Non-file-backed data, such as GTFS-Realtime entities. */
          file: null;
          table: string;
        }
    );

export type GtfsTableName<Definition> = Definition extends {
  file: null;
  table: infer TableName extends string;
}
  ? TableName
  : Definition extends { file: infer File extends string }
    ? File extends `${infer TableName}.${string}`
      ? TableName
      : File
    : never;

function validateDefinition<Fields extends GtfsFields>(
  definition: GtfsTableDefinition<Fields>,
): void {
  const tableName = definition.file ?? definition.table;
  const fieldNames = new Set(Object.keys(definition.fields));

  for (const primaryField of definition.primaryKey ?? []) {
    if (!fieldNames.has(primaryField)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: primary key field ${primaryField} is not defined`,
      );
    }
  }

  for (const constraint of definition.constraints ?? []) {
    if (
      !fieldNames.has(constraint.startField) ||
      !fieldNames.has(constraint.endField)
    ) {
      throw new Error(
        `Invalid GTFS table ${tableName}: range constraint references an unknown field`,
      );
    }
  }

  for (const configuredIndex of definition.storage?.indexes ?? []) {
    const indexColumns =
      typeof configuredIndex === 'string' ? [configuredIndex] : configuredIndex;
    for (const column of indexColumns) {
      const isGeneratedTimestamp = Object.entries(definition.fields).some(
        ([fieldName, field]) =>
          field.kind === 'time' &&
          (fieldName.endsWith('_time')
            ? `${fieldName}stamp`
            : `${fieldName}_timestamp`) === column,
      );
      if (!fieldNames.has(column) && !isGeneratedTimestamp) {
        throw new Error(
          `Invalid GTFS table ${tableName}: index field ${column} is not defined`,
        );
      }
    }
  }
}

/**
 * Defines and validates one canonical GTFS table manifest.
 */
export function defineGtfsTable<
  const Fields extends GtfsFields,
  const Definition extends GtfsTableDefinition<Fields>,
>(definition: Definition): Definition {
  validateDefinition(definition);
  return definition;
}

/** A standards-defined enumeration that retains known-value autocomplete. */
export type GtfsEnumerationValue<
  KnownValue extends string | number,
  Closed extends boolean = false,
> = Closed extends true
  ? KnownValue
  : KnownValue extends string
    ? KnownValue | (string & Record<never, never>)
    : KnownValue extends number
      ? KnownValue | (number & Record<never, never>)
      : never;

type ValueForKind<Field extends GtfsFieldDefinition> = Field extends {
  kind: 'enumeration';
  values: readonly (infer Value extends string | number)[];
}
  ? GtfsEnumerationValue<Value, Field extends { closed: true } ? true : false>
  : Field['kind'] extends 'integer' | 'real' | 'date'
    ? number
    : string;

type NullableUnlessRequired<
  Value,
  Definition extends { presence?: GtfsPresence },
> = Definition['presence'] extends 'required' ? Value : Value | null;

type RowFromFields<Fields extends GtfsFields> = {
  [Name in keyof Fields]: NullableUnlessRequired<
    ValueForKind<Fields[Name]>,
    Fields[Name]
  >;
};

/** Normalized row inferred from a table definition. */
export type GtfsRow<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsFields
    ? RowFromFields<Fields>
    : never
  : never;

type GeneratedTimestampName<Name extends string> = Name extends `${string}_time`
  ? `${Name}stamp`
  : `${Name}_timestamp`;

type StoredTimestampFields<Fields extends GtfsFields> = {
  [
    Name in keyof Fields as Fields[Name]['kind'] extends 'time'
      ? GeneratedTimestampName<Extract<Name, string>>
      : never
  ]: Fields[Name]['presence'] extends 'required' ? number : number | null;
};

/** Database row, including node-gtfs generated timestamp columns. */
export type GtfsStoredRow<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsFields
    ? RowFromFields<Fields> & StoredTimestampFields<Fields>
    : never
  : never;

type RequiredFieldNames<Fields extends GtfsFields> = {
  [Name in keyof Fields]: Fields[Name]['presence'] extends 'required'
    ? Name
    : never;
}[keyof Fields];

type InsertFromFields<Fields extends GtfsFields> = {
  [Name in RequiredFieldNames<Fields>]: ValueForKind<Fields[Name]>;
} & {
  [Name in Exclude<keyof Fields, RequiredFieldNames<Fields>>]?: ValueForKind<
    Fields[Name]
  > | null;
};

/** Insert object inferred from a rich table manifest. */
export type GtfsInsert<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsFields
    ? InsertFromFields<Fields>
    : never
  : never;

/** Equality/IN query object inferred from a table manifest. */
export type GtfsQuery<Table> = {
  [Name in keyof GtfsStoredRow<Table>]?:
    GtfsStoredRow<Table>[Name] | readonly GtfsStoredRow<Table>[Name][];
};

export type GtfsDatabaseFromTables<
  Tables extends Record<string, GtfsTableDefinition>,
> = {
  [Table in Tables[keyof Tables] as GtfsTableName<Table>]: GtfsStoredRow<Table>;
};
