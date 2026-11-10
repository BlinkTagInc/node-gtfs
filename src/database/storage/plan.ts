import {
  getServiceDaySecondsFieldName,
  getStorageKeyColumnNames,
  GTFS_CANONICAL_KEY_COLUMN,
  GTFS_UNKNOWN_FIELDS_COLUMN,
  GTFS_SOURCE_ID_COLUMN,
  type CompiledGtfsColumn,
  type CompiledGtfsTable,
} from '../../schema/compile-table.ts';
import { compiledTables } from '../../schema/table-registry.ts';
import {
  getGtfsDialectCapabilities,
  shortenDatabaseIdentifier,
  type GtfsDatabaseDialect,
} from '../dialects.ts';
import {
  filterGtfsTablesByExtensions,
  resolveGtfsExtensions,
} from '../../schema/extensions.ts';
import type { GtfsSchemaLifecycleOptions } from '../schema-lifecycle.ts';
import { getCaseFoldColumnName } from '../../values/case-fold.ts';
import { sourceStateTable } from '../source-state.ts';

export const MYSQL_STORAGE_KEY_HASH_COLUMN = '_node_gtfs_storage_key';

type GtfsStorageColumnRole =
  | 'source-id'
  | 'manifest'
  | 'case-fold'
  | 'service-time'
  | 'unknown-fields'
  | 'canonical-key'
  | 'storage-key-hash';

type GtfsStorageDataType =
  | 'bigint'
  | 'date'
  | 'integer'
  | 'json'
  | 'key-digest'
  | 'real'
  | 'text'
  | 'time';

export type GtfsStorageColumnCheckPlan =
  | Readonly<{
      kind: 'allowed-values';
      values: readonly (string | number)[];
    }>
  | Readonly<{
      kind: 'range';
      minimum?: number;
      maximum?: number;
    }>
  | Readonly<{
      kind: 'storage-class';
      storageClass: 'integer' | 'real';
    }>
  | Readonly<{
      kind: 'exact-length';
      length: number;
    }>;

interface GtfsStorageGeneratedValuePlan {
  readonly kind: 'service-time-seconds';
  readonly sourceColumnName: string;
}

export interface GtfsStorageColumnPlan {
  readonly name: string;
  readonly role: GtfsStorageColumnRole;
  readonly sourceColumn?: CompiledGtfsColumn;
  readonly dataType: GtfsStorageDataType;
  readonly required: boolean;
  readonly defaultValue?: string | number | null;
  readonly binaryCollation: boolean;
  readonly checks: readonly GtfsStorageColumnCheckPlan[];
  readonly generatedValue?: GtfsStorageGeneratedValuePlan;
  readonly checkConstraintName?: string;
}

export interface GtfsStorageIndexPlan {
  readonly name: string;
  readonly columns: readonly string[];
  readonly prefixLengths: readonly (number | null)[];
}

type GtfsStorageKeyPlan =
  | Readonly<{
      kind: 'none';
      columns: readonly string[];
      name?: never;
    }>
  | Readonly<{
      kind: 'primary-key' | 'unique';
      name: string;
      columns: readonly string[];
    }>;

export interface GtfsTableStoragePlan {
  readonly table: CompiledGtfsTable;
  readonly columns: readonly GtfsStorageColumnPlan[];
  readonly columnNames: readonly string[];
  readonly storageKeyColumns: readonly string[];
  readonly physicalKeyStrategy: 'none' | 'columns' | 'canonical' | 'hash';
  readonly key: GtfsStorageKeyPlan;
  readonly indexes: readonly GtfsStorageIndexPlan[];
}

export interface GtfsStoragePlan {
  readonly dialect: GtfsDatabaseDialect;
  readonly mode: NonNullable<GtfsSchemaLifecycleOptions['mode']>;
  readonly tables: readonly GtfsTableStoragePlan[];
}

interface GtfsStoragePlanOptions extends GtfsSchemaLifecycleOptions {
  readonly dialect: GtfsDatabaseDialect;
  /** @internal Explicit manifest subset managed by one operation. */
  readonly tables?: readonly CompiledGtfsTable[];
}

function freezeColumn(column: GtfsStorageColumnPlan): GtfsStorageColumnPlan {
  return Object.freeze({
    ...column,
    checks: Object.freeze(
      column.checks.map((check) =>
        check.kind === 'allowed-values'
          ? Object.freeze({
              ...check,
              values: Object.freeze([...check.values]),
            })
          : Object.freeze({ ...check }),
      ),
    ),
    ...(column.generatedValue === undefined
      ? {}
      : { generatedValue: Object.freeze(column.generatedValue) }),
  });
}

function createManifestColumnPlan(
  table: CompiledGtfsTable,
  column: CompiledGtfsColumn,
  dialect: GtfsDatabaseDialect,
): GtfsStorageColumnPlan {
  const checks: GtfsStorageColumnCheckPlan[] = [];
  if (column.minimum !== undefined || column.maximum !== undefined) {
    checks.push(
      Object.freeze({
        kind: 'range',
        ...(column.minimum === undefined ? {} : { minimum: column.minimum }),
        ...(column.maximum === undefined ? {} : { maximum: column.maximum }),
      }),
    );
  }
  if (column.kind === 'enumeration' && column.closed) {
    checks.push(
      Object.freeze({
        kind: 'allowed-values',
        values: Object.freeze([...column.values]),
      }),
    );
  }
  if (column.valueKind === 'integer' || column.valueKind === 'real') {
    checks.push(
      Object.freeze({
        kind: 'storage-class',
        storageClass: column.valueKind,
      }),
    );
  }

  return {
    name: column.name,
    role: 'manifest',
    sourceColumn: column,
    dataType: column.monetary ? 'bigint' : column.valueKind,
    required: column.presence === 'required',
    ...(column.defaultValue === undefined
      ? {}
      : { defaultValue: column.defaultValue }),
    binaryCollation: ['text', 'json', 'time'].includes(column.valueKind),
    checks,
    ...(checks.some(({ kind }) => kind !== 'storage-class')
      ? {
          checkConstraintName: shortenDatabaseIdentifier(
            `check_${table.tableName}_${column.name}`,
            dialect,
          ),
        }
      : {}),
  };
}

function getIndexColumns(table: CompiledGtfsTable): string[][] {
  const indexes: string[][] = [];
  const seen = new Set<string>();

  for (const configuredIndex of table.indexes ?? []) {
    const columns =
      typeof configuredIndex === 'string'
        ? [configuredIndex]
        : [...configuredIndex];
    if (columns.length === 0) {
      continue;
    }

    const key = columns.join('\0');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    indexes.push(columns);
  }

  return indexes;
}

type TableStoragePlanOptions = Pick<GtfsStoragePlan, 'dialect'>;

function createTableColumnPlans(
  table: CompiledGtfsTable,
  options: TableStoragePlanOptions,
): GtfsStorageColumnPlan[] {
  const columns: GtfsStorageColumnPlan[] = [
    {
      name: GTFS_SOURCE_ID_COLUMN,
      role: 'source-id',
      dataType: 'text',
      required: true,
      binaryCollation: true,
      checks: [],
    },
  ];

  for (const column of table.columns) {
    columns.push(createManifestColumnPlan(table, column, options.dialect));
    if (column.supportsCaseInsensitiveComparison) {
      columns.push({
        name: getCaseFoldColumnName(column.name),
        role: 'case-fold',
        sourceColumn: column,
        dataType: 'text',
        required: false,
        binaryCollation: true,
        checks: [],
      });
    }
    if (column.valueKind === 'time') {
      columns.push({
        name: getServiceDaySecondsFieldName(column.name),
        role: 'service-time',
        sourceColumn: column,
        dataType: 'integer',
        required: false,
        binaryCollation: false,
        checks: [],
        generatedValue: {
          kind: 'service-time-seconds',
          sourceColumnName: column.name,
        },
      });
    }
  }

  columns.push({
    name: GTFS_UNKNOWN_FIELDS_COLUMN,
    role: 'unknown-fields',
    dataType: 'json',
    required: false,
    binaryCollation: false,
    checks: [],
  });

  return columns;
}

function createTableKeyPlan(
  table: CompiledGtfsTable,
  options: TableStoragePlanOptions,
): Pick<
  GtfsTableStoragePlan,
  'storageKeyColumns' | 'physicalKeyStrategy' | 'key'
> & {
  readonly columns: readonly GtfsStorageColumnPlan[];
} {
  const columns: GtfsStorageColumnPlan[] = [];
  const storageKeyColumns = getStorageKeyColumnNames(table);
  const capabilities = getGtfsDialectCapabilities(options.dialect);
  let physicalKeyStrategy: GtfsTableStoragePlan['physicalKeyStrategy'] = 'none';
  if (table.keyStrategy === 'canonical') {
    physicalKeyStrategy = 'canonical';
    columns.push({
      name: GTFS_CANONICAL_KEY_COLUMN,
      role: 'canonical-key',
      dataType: 'key-digest',
      required: true,
      binaryCollation: false,
      checks: [
        {
          kind: 'exact-length',
          length: 64,
        },
      ],
      checkConstraintName: shortenDatabaseIdentifier(
        `check_${table.tableName}_${GTFS_CANONICAL_KEY_COLUMN}`,
        options.dialect,
      ),
    });
  } else if (table.keyStrategy === 'columns' && storageKeyColumns.length > 0) {
    if (capabilities.primaryKeyStrategy === 'hash') {
      physicalKeyStrategy = 'hash';
      columns.push({
        name: MYSQL_STORAGE_KEY_HASH_COLUMN,
        role: 'storage-key-hash',
        dataType: 'key-digest',
        required: false,
        binaryCollation: false,
        checks: [],
      });
    } else {
      physicalKeyStrategy = 'columns';
    }
  }

  const key: GtfsStorageKeyPlan =
    physicalKeyStrategy === 'canonical'
      ? {
          kind: 'unique',
          name: shortenDatabaseIdentifier(
            `unique_${table.tableName}_${GTFS_CANONICAL_KEY_COLUMN}`,
            options.dialect,
          ),
          columns: [GTFS_CANONICAL_KEY_COLUMN],
        }
      : physicalKeyStrategy === 'hash'
        ? {
            kind: 'unique',
            name: shortenDatabaseIdentifier(
              `unique_${table.tableName}_storage_key`,
              options.dialect,
            ),
            columns: [MYSQL_STORAGE_KEY_HASH_COLUMN],
          }
        : physicalKeyStrategy === 'columns'
          ? {
              kind: 'primary-key',
              name: shortenDatabaseIdentifier(
                `primary_${table.tableName}`,
                options.dialect,
              ),
              columns: storageKeyColumns,
            }
          : { kind: 'none', columns: [] };

  return { storageKeyColumns, physicalKeyStrategy, key, columns };
}

function createTableIndexPlans({
  table,
  columns,
  key,
  options,
}: {
  readonly table: CompiledGtfsTable;
  readonly columns: readonly GtfsStorageColumnPlan[];
  readonly key: GtfsStorageKeyPlan;
  readonly options: TableStoragePlanOptions;
}): readonly GtfsStorageIndexPlan[] {
  const capabilities = getGtfsDialectCapabilities(options.dialect);
  const indexColumns = getIndexColumns(table);
  // Digest keys enforce uniqueness but cannot serve source-scoped lookups.
  if (
    key.columns[0] !== GTFS_SOURCE_ID_COLUMN &&
    !indexColumns.some((index) => index[0] === GTFS_SOURCE_ID_COLUMN)
  ) {
    indexColumns.push([GTFS_SOURCE_ID_COLUMN]);
  }
  const plannedColumnsByName = new Map(
    columns.map((column) => [column.name, column] as const),
  );
  const indexes = indexColumns.map((index) =>
    Object.freeze({
      // SQLite retains the full stable name; PostgreSQL and MySQL impose
      // shorter identifier limits.
      name:
        options.dialect === 'sqlite'
          ? `idx_${table.tableName}_${index.join('_')}`
          : shortenDatabaseIdentifier(
              `idx_${table.tableName}_${index.join('_')}`,
              options.dialect,
            ),
      columns: Object.freeze([...index]),
      prefixLengths: Object.freeze(
        index.map((columnName) => {
          const column = plannedColumnsByName.get(columnName);
          return capabilities.textIndexPrefixLength !== undefined &&
            column !== undefined &&
            ['text', 'time', 'json'].includes(column.dataType)
            ? capabilities.textIndexPrefixLength
            : null;
        }),
      ),
    }),
  );
  return indexes;
}

function createTableStoragePlan(
  table: CompiledGtfsTable,
  options: TableStoragePlanOptions,
): GtfsTableStoragePlan {
  const {
    storageKeyColumns,
    physicalKeyStrategy,
    key,
    columns: keyColumns,
  } = createTableKeyPlan(table, options);
  const columns = [...createTableColumnPlans(table, options), ...keyColumns];
  const indexes = createTableIndexPlans({ table, columns, key, options });
  const frozenColumns = Object.freeze(columns.map(freezeColumn));

  return Object.freeze({
    table,
    columns: frozenColumns,
    columnNames: Object.freeze(frozenColumns.map(({ name }) => name)),
    storageKeyColumns: Object.freeze(storageKeyColumns),
    physicalKeyStrategy,
    key: Object.freeze({
      ...key,
      columns: Object.freeze([...key.columns]),
    }),
    indexes: Object.freeze(indexes),
  });
}

/** Compiles one immutable physical-storage contract for an operation. */
export function createGtfsStoragePlan(
  options: GtfsStoragePlanOptions,
): GtfsStoragePlan {
  const tables = options.tables ?? [
    sourceStateTable,
    ...filterGtfsTablesByExtensions(
      compiledTables,
      resolveGtfsExtensions(options.extensions),
    ),
  ];

  resolveGtfsExtensions([
    ...new Set(
      tables
        .map(({ specification }) => specification)
        .filter((specification) => specification !== 'gtfs-schedule'),
    ),
  ]);

  return Object.freeze({
    dialect: options.dialect,
    mode: options.mode ?? 'ensure',
    tables: Object.freeze(
      tables.map((table) =>
        createTableStoragePlan(table, {
          dialect: options.dialect,
        }),
      ),
    ),
  });
}

export function getGtfsTableStoragePlan(
  plan: GtfsStoragePlan,
  tableName: string,
): GtfsTableStoragePlan {
  const table = plan.tables.find(({ table }) => table.tableName === tableName);
  if (table === undefined) {
    throw new Error(`Storage plan does not contain GTFS table ${tableName}`);
  }
  return table;
}
