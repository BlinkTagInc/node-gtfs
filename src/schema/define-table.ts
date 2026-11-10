import { validateDomainFields } from './domain-table.ts';
import type { GtfsDomainFields } from './domain-table.ts';
import { assertConfigOptionKeys } from '../config/options.ts';
import {
  validateStorageKeyDefinition,
  validateIndexDefinitions,
} from '../database/storage/validate-policy.ts';

/** Canonical order for optional GTFS extensions. */
export const gtfsExtensions = [
  'gtfs-realtime',
  'gtfs-plus',
  'gtfs-ride',
  'gtfs-to-html',
  'tods',
  'tods-v1',
  'tides',
] as const;

export type GtfsExtension = (typeof gtfsExtensions)[number];

/** Canonical order for every supported GTFS specification. */
export const gtfsSpecifications = ['gtfs-schedule', ...gtfsExtensions] as const;

export type GtfsSpecification = (typeof gtfsSpecifications)[number];

export type GtfsPresence =
  | 'required'
  | 'optional'
  | 'conditionally-required'
  | 'conditionally-forbidden'
  | 'recommended';

export type GtfsConditionValue = string | number | boolean | null;

/** A declarative predicate evaluated against another value in the same row. */
export interface GtfsRowCondition {
  readonly field: string;
  readonly equals?: GtfsConditionValue;
  readonly in?: readonly GtfsConditionValue[];
}

export type GtfsFieldKind =
  'id' | 'text' | 'integer' | 'real' | 'date' | 'time' | 'json' | 'enumeration';

/** Reference to a field in another GTFS source file. */
export interface GtfsReference {
  readonly targetFilename: string;
  readonly targetField: string;
  /** Narrows a conditional or polymorphic reference using another row field. */
  readonly when?: GtfsRowCondition;
  /** References are validation metadata and never imply a database foreign key. */
  readonly relationship?:
    'advisory' | 'conditional' | 'polymorphic' | 'unambiguous';
}

export interface GtfsMonetaryDefinition {
  /** Field containing the ISO 4217 currency code for this amount. */
  readonly currencyField: string;
  readonly publicRepresentation: 'decimal-string';
  readonly storageRepresentation: 'minor-units';
}

export interface GtfsConditionalNormalization {
  /** Treat the value as a source-scoped reference only when `when` matches. */
  readonly kind: 'source-reference';
  readonly when: GtfsRowCondition;
}

export interface GtfsFieldOptions {
  /** Whether every record must contain a non-empty value. */
  readonly presence?: GtfsPresence;
  /** Alternative GTFS source fields that this value may identify. */
  readonly references?: readonly GtfsReference[];
  /** Value supplied during normalization when the source value is empty. */
  readonly defaultValue?: string | number | null;
  /** Enable explicit insensitive queries without changing default comparisons. */
  readonly supportsCaseInsensitiveComparison?: boolean;
  /** Dot-separated path used to extract this field from a source object. */
  readonly sourcePath?: string;
  /** Inclusive numeric lower bound. */
  readonly minimum?: number;
  /** Inclusive numeric upper bound. */
  readonly maximum?: number;
  /** Exact currency semantics for a numeric source field. */
  readonly monetary?: GtfsMonetaryDefinition;
  /** Row-dependent normalization metadata. Rules do not install constraints. */
  readonly normalization?: readonly GtfsConditionalNormalization[];
}

export type GtfsFieldDefinition =
  | (GtfsFieldOptions & {
      readonly kind: Exclude<GtfsFieldKind, 'enumeration'>;
      readonly values?: never;
    })
  | (GtfsFieldOptions & {
      readonly kind: 'enumeration';
      /** Whether values outside `values` are semantically invalid. Defaults to false. */
      readonly closed?: boolean;
      readonly values: readonly [string | number, ...(string | number)[]];
    });

export interface GtfsRangeConstraint {
  readonly kind: 'range';
  readonly startField: string;
  readonly endField: string;
  readonly allowEqual: boolean;
}

export interface GtfsConditionalPresenceConstraint {
  readonly kind: 'conditional-presence';
  readonly field: string;
  readonly presence: 'required' | 'forbidden';
  readonly when: GtfsRowCondition;
}

export type GtfsSemanticConstraint =
  GtfsRangeConstraint | GtfsConditionalPresenceConstraint;

export type GtfsKeyStrategy = 'columns' | 'canonical' | 'none';

export interface GtfsDerivedFieldDefinition {
  readonly kind: 'integer';
  readonly sourceField: string;
  readonly expression: 'service-day-seconds';
  readonly selectedByDefault: false;
}

type GtfsFields = Readonly<Record<string, GtfsFieldDefinition>>;

interface GtfsTableMetadata<Fields extends GtfsFields> {
  readonly specification: GtfsSpecification;
  /** Exact GTFS source filename, or null for a derived/non-file table. */
  readonly filename: string | null;
  /** Canonical database table name. */
  readonly tableName: string;
  readonly presence: GtfsPresence;
  /** Fields identified as the primary key by the governing specification. */
  readonly primaryKey?: readonly Extract<keyof Fields, string>[];
  /** Effective node-GTFS identity, including source provenance. */
  readonly storageKey?:
    readonly ['source_id', ...Extract<keyof Fields, string>[]] | null;
  /** Portable strategy used to enforce the source-scoped storage key. */
  readonly keyStrategy: GtfsKeyStrategy;
  /** Single-column names or ordered composite-index column lists. */
  readonly indexes?: readonly (string | readonly string[])[];
  readonly fields: Fields;
  readonly constraints?: readonly GtfsSemanticConstraint[];
}

export type GtfsTableDefinition<Fields extends GtfsFields = GtfsFields> = Omit<
  GtfsTableMetadata<Fields>,
  'primaryKey' | 'storageKey' | 'keyStrategy'
> & {
  readonly primaryKey: readonly Extract<keyof Fields, string>[];
  readonly storageKey:
    readonly ['source_id', ...Extract<keyof Fields, string>[]] | null;
  readonly keyStrategy: GtfsKeyStrategy;
};

type GtfsTableInput<Fields extends GtfsFields> = GtfsTableMetadata<Fields>;

export type GtfsTableName<Definition> = Definition extends {
  tableName: infer TableName extends string;
}
  ? TableName
  : never;

function validateDefinition<Fields extends GtfsFields>(
  definition: GtfsTableInput<Fields>,
): void {
  assertConfigOptionKeys(definition, {
    name: 'defineGtfsTable()',
    keys: [
      'specification',
      'filename',
      'tableName',
      'presence',
      'primaryKey',
      'storageKey',
      'keyStrategy',
      'indexes',
      'fields',
      'constraints',
    ],
    removed: {
      file: 'filename',
      table: 'tableName',
      storage: 'indexes',
    },
  });
  const tableName = definition.tableName;
  const fieldNames = new Set(Object.keys(definition.fields));
  for (const primaryField of definition.primaryKey ?? []) {
    if (!fieldNames.has(primaryField)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: primary key field ${primaryField} is not defined`,
      );
    }
  }

  validateDomainFields(definition, fieldNames);
  validateStorageKeyDefinition(definition, fieldNames);
  validateIndexDefinitions(definition, fieldNames);
}

export function defineGtfsTable<
  const Definition extends GtfsTableInput<GtfsFields>,
>(
  definition: Definition,
): Definition & {
  readonly primaryKey: Definition extends {
    readonly primaryKey: infer Key extends readonly string[];
  }
    ? Key
    : readonly [];
  readonly storageKey: Definition extends {
    readonly storageKey: infer Key extends readonly string[] | null;
  }
    ? Key
    : readonly [
        'source_id',
        ...(Definition extends {
          readonly primaryKey: infer Key extends readonly string[];
        }
          ? Key
          : readonly []),
      ];
  readonly keyStrategy: Definition['keyStrategy'];
} {
  validateDefinition(definition);
  const primaryKey = definition.primaryKey ?? [];
  const storageKey =
    definition.storageKey === undefined
      ? (['source_id', ...primaryKey] as const)
      : definition.storageKey;
  return {
    ...definition,
    primaryKey,
    storageKey,
    keyStrategy: definition.keyStrategy,
  } as never;
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

type ValueForKind<Field extends GtfsDomainFields[string]> = Field extends {
  monetary: { readonly currencyField: string };
}
  ? string
  : Field extends {
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

type RowFromFields<Fields extends GtfsDomainFields> = {
  -readonly [Name in keyof Fields]: NullableUnlessRequired<
    ValueForKind<Fields[Name]>,
    Fields[Name]
  >;
};

export type GtfsNormalizedRow<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsDomainFields
    ? RowFromFields<Fields>
    : never
  : never;

type StoredUnknownFields = { _unknown_fields: string | null };
type StoredSourceFields = { source_id: string };

type PublicServiceDaySecondsName<Name extends string> =
  Name extends `${infer BaseName}_time`
    ? `${BaseName}_service_day_seconds`
    : `${Name}_service_day_seconds`;

type PublicDerivedFields<Fields extends GtfsDomainFields> = {
  -readonly [
    Name in keyof Fields as Fields[Name]['kind'] extends 'time'
      ? PublicServiceDaySecondsName<Extract<Name, string>>
      : never
  ]: Fields[Name]['presence'] extends 'required' ? number : number | null;
};

/** Stable default public row: source identity plus manifest input fields. */
export type GtfsDefaultRow<Table> = Table extends {
  fields: infer Fields;
}
  ? Fields extends GtfsDomainFields
    ? StoredSourceFields & RowFromFields<Fields>
    : never
  : never;

/** Every selectable public field, including explicit service-day seconds. */
export type GtfsSelectableRow<Table> = Table extends {
  fields: infer Fields;
}
  ? Fields extends GtfsDomainFields
    ? GtfsDefaultRow<Table> & PublicDerivedFields<Fields>
    : never
  : never;

type StoredRowFromFields<Fields extends GtfsDomainFields> = {
  -readonly [Name in keyof Fields]: NullableUnlessRequired<
    Fields[Name] extends { monetary: { readonly currencyField: string } }
      ? number | bigint | string
      : ValueForKind<Fields[Name]>,
    Fields[Name]
  >;
};

/** Database row, including generated service-day seconds and unknown fields. */
export type GtfsStoredRow<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsDomainFields
    ? StoredRowFromFields<Fields> &
        PublicDerivedFields<Fields> &
        StoredSourceFields &
        StoredUnknownFields
    : never
  : never;

type RequiredFieldNames<Fields extends GtfsDomainFields> = {
  [Name in keyof Fields]: Fields[Name]['presence'] extends 'required'
    ? Name
    : never;
}[keyof Fields];

type InsertFromFields<Fields extends GtfsDomainFields> = {
  -readonly [Name in RequiredFieldNames<Fields>]: ValueForKind<Fields[Name]>;
} & {
  -readonly [
    Name in Exclude<keyof Fields, RequiredFieldNames<Fields>>
  ]?: ValueForKind<Fields[Name]> | null;
};

export type GtfsInsertRow<Table> = Table extends { fields: infer Fields }
  ? Fields extends GtfsDomainFields
    ? InsertFromFields<Fields> & StoredSourceFields
    : never
  : never;

/** Equality/IN query object inferred from a table manifest. */
export type GtfsStoredRowFilter<Table> = {
  readonly [Name in keyof GtfsStoredRow<Table>]?:
    GtfsStoredRow<Table>[Name] | readonly GtfsStoredRow<Table>[Name][];
};

export type GtfsDatabaseFromTables<
  Tables extends Record<
    string,
    { readonly tableName: string; readonly fields: GtfsDomainFields }
  >,
> = {
  [Table in Tables[keyof Tables] as GtfsTableName<Table>]: GtfsStoredRow<Table>;
};
