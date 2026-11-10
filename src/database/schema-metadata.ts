import type {
  GtfsSchemaInspection,
  GtfsTableSchemaIssue,
} from './schema-lifecycle.ts';
import type { GtfsStoragePlan } from './storage/plan.ts';
import {
  sqliteServiceTimeExpression,
  normalizeSqlExpression,
} from './sqlite/expressions.ts';

interface GtfsPhysicalColumnMetadata {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: boolean;
  readonly hasDefaultValue: boolean;
  readonly generated: boolean;
  readonly defaultExpression?: string | null;
  readonly generatedExpression?: string | null;
}

interface GtfsPhysicalTableMetadata {
  readonly name: string;
  readonly columns: readonly GtfsPhysicalColumnMetadata[];
}

export interface GtfsPhysicalIndexMetadata {
  readonly name: string;
  readonly tableName: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly primary: boolean;
  readonly partial: boolean;
  readonly predicate?: string | null;
  readonly descending: readonly boolean[];
  readonly prefixLengths: readonly (number | null)[];
}

function defaultMatches(
  expression: string | null | undefined,
  value: string | number | null,
): boolean {
  if (expression === undefined) {
    return false;
  }
  const actual = (expression ?? 'null')
    .replace(/::[a-z ]+(?:\[\])?$/iu, '')
    .trim()
    .replace(/^\((.*)\)$/su, '$1');
  const expected =
    typeof value === 'string'
      ? `'${value.replaceAll("'", "''")}'`
      : String(value);
  return normalizeSqlExpression(actual) === normalizeSqlExpression(expected);
}

export interface GtfsPhysicalSchemaMetadata {
  readonly tables: readonly GtfsPhysicalTableMetadata[];
  readonly indexes: readonly GtfsPhysicalIndexMetadata[];
}

type NormalizedGtfsDataType = 'bigint' | 'integer' | 'real' | 'text';

function getExpectedDataType(
  plan: GtfsStoragePlan,
  dataType: GtfsStoragePlan['tables'][number]['columns'][number]['dataType'],
): NormalizedGtfsDataType {
  if (dataType === 'bigint') {
    return plan.dialect === 'sqlite' ? 'integer' : 'bigint';
  }
  if (dataType === 'integer' || dataType === 'date') {
    return 'integer';
  }
  if (dataType === 'real') {
    return 'real';
  }
  return 'text';
}

function normalizePhysicalDataType(
  dialect: GtfsStoragePlan['dialect'],
  dataType: string,
): NormalizedGtfsDataType | 'unknown' {
  const normalized = dataType.trim().toLowerCase();
  if (dialect === 'sqlite' && /\b(?:bigint|int8)\b/u.test(normalized)) {
    return 'integer';
  }
  if (dialect === 'sqlite' && normalized === 'date') {
    return 'integer';
  }
  if (dialect === 'sqlite' && normalized === 'time') {
    return 'text';
  }
  if (/\bbigint\b|\bint8\b/u.test(normalized)) {
    return 'bigint';
  }
  if (
    /\b(?:int|int2|int4|integer|mediumint|smallint|tinyint)\b/u.test(normalized)
  ) {
    return 'integer';
  }
  if (/\b(?:double|float|float4|float8|real)\b/u.test(normalized)) {
    return 'real';
  }
  if (
    /\b(?:char|character varying|clob|json|text|varchar)\b/u.test(normalized)
  ) {
    return 'text';
  }
  return 'unknown';
}

type ColumnCompatibility = Required<
  Pick<
    GtfsTableSchemaIssue,
    | 'missingColumns'
    | 'unexpectedlyNullableColumns'
    | 'missingDefaultColumns'
    | 'incompatibleDefaults'
    | 'incompatibleColumnTypes'
    | 'incompatibleGeneratedColumns'
  >
>;

function compareTableColumns(options: {
  readonly plan: GtfsStoragePlan;
  readonly tablePlan: GtfsStoragePlan['tables'][number];
  readonly table: GtfsPhysicalTableMetadata | undefined;
  readonly validateStorage: boolean;
  readonly databaseGeneratesServiceTimeColumns: boolean;
}): ColumnCompatibility {
  const {
    plan,
    tablePlan,
    table,
    validateStorage,
    databaseGeneratesServiceTimeColumns,
  } = options;
  const columnsByName = new Map(
    table?.columns.map((column) => [column.name, column]) ?? [],
  );
  const missingColumns = tablePlan.columnNames.filter(
    (columnName) => !columnsByName.has(columnName),
  );
  const unexpectedlyNullableColumns = tablePlan.columns
    .filter(
      (column) =>
        column.required && columnsByName.get(column.name)?.nullable === true,
    )
    .map((column) => column.name);
  const missingDefaultColumns = tablePlan.columns
    .filter(
      (column) =>
        validateStorage &&
        column.defaultValue !== undefined &&
        columnsByName.get(column.name)?.hasDefaultValue === false,
    )
    .map((column) => column.name);
  const incompatibleDefaults = tablePlan.columns
    .filter((column) => {
      const physical = columnsByName.get(column.name);
      return (
        validateStorage &&
        column.defaultValue !== undefined &&
        physical?.hasDefaultValue === true &&
        !defaultMatches(physical.defaultExpression, column.defaultValue)
      );
    })
    .map(({ name }) => name);
  const incompatibleColumnTypes = tablePlan.columns.flatMap((column) => {
    const physicalColumn = columnsByName.get(column.name);
    if (physicalColumn === undefined) {
      return [];
    }
    const expectedType = getExpectedDataType(plan, column.dataType);
    return normalizePhysicalDataType(plan.dialect, physicalColumn.dataType) ===
      expectedType
      ? []
      : [
          {
            columnName: column.name,
            expectedType,
            actualType: physicalColumn.dataType,
          },
        ];
  });
  const incompatibleGeneratedColumns = tablePlan.columns
    .filter((column) => {
      const physicalColumn = columnsByName.get(column.name);
      if (!validateStorage || physicalColumn === undefined) {
        return false;
      }
      const expectedGenerated =
        databaseGeneratesServiceTimeColumns &&
        column.generatedValue !== undefined;
      return (
        physicalColumn.generated !== expectedGenerated ||
        (expectedGenerated &&
          column.generatedValue !== undefined &&
          normalizeSqlExpression(physicalColumn.generatedExpression ?? '') !==
            normalizeSqlExpression(
              sqliteServiceTimeExpression(
                column.generatedValue.sourceColumnName,
              ),
            ))
      );
    })
    .map((column) => column.name);

  return {
    missingColumns,
    unexpectedlyNullableColumns,
    missingDefaultColumns,
    incompatibleDefaults,
    incompatibleColumnTypes,
    incompatibleGeneratedColumns,
  };
}

function sameColumns(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((column, index) => column === right[index])
  );
}

function isStorageKeyCompatible(
  key: GtfsStoragePlan['tables'][number]['key'],
  indexes: readonly GtfsPhysicalIndexMetadata[],
): boolean {
  return (
    key.kind === 'none' ||
    indexes.some(
      (index) =>
        index.unique &&
        !index.partial &&
        (key.kind !== 'primary-key' || index.primary) &&
        index.prefixLengths.every((length) => length === null) &&
        sameColumns(index.columns, key.columns),
    )
  );
}

function compareTableIndexes(options: {
  readonly dialect: GtfsStoragePlan['dialect'];
  readonly tablePlan: GtfsStoragePlan['tables'][number];
  readonly physicalIndexes: readonly GtfsPhysicalIndexMetadata[];
  readonly includeIndexes: boolean;
}): Required<
  Pick<GtfsTableSchemaIssue, 'missingIndexes' | 'incompatibleIndexes'>
> {
  const { dialect, tablePlan, physicalIndexes, includeIndexes } = options;
  const storedIndexNames = new Set(physicalIndexes.map(({ name }) => name));
  const missingIndexes = includeIndexes
    ? tablePlan.indexes
        .map(({ name }) => name)
        .filter((name) => !storedIndexNames.has(name))
    : [];
  const incompatibleIndexes = includeIndexes
    ? tablePlan.indexes
        .filter((expected) => {
          const actual = physicalIndexes.find(
            (index) => index.name === expected.name,
          );
          const compatiblePartial =
            dialect === 'sqlite' &&
            expected.columns.length === 1 &&
            normalizeSqlExpression(actual?.predicate ?? '') ===
              normalizeSqlExpression(`"${expected.columns[0]}" IS NOT NULL`);
          return (
            actual !== undefined &&
            ((actual.partial && !compatiblePartial) ||
              actual.unique ||
              actual.descending.some(Boolean) ||
              !sameColumns(actual.columns, expected.columns) ||
              JSON.stringify(actual.prefixLengths) !==
                JSON.stringify(expected.prefixLengths))
          );
        })
        .map(({ name }) => name)
    : [];

  return { missingIndexes, incompatibleIndexes };
}

export function compareGtfsStoragePlan(
  plan: GtfsStoragePlan,
  metadata: GtfsPhysicalSchemaMetadata,
  options: {
    readonly includeIndexes: boolean;
    readonly databaseGeneratesServiceTimeColumns?: boolean;
    readonly purpose?: 'storage' | 'query';
  },
): GtfsSchemaInspection {
  const {
    includeIndexes,
    databaseGeneratesServiceTimeColumns = plan.dialect === 'sqlite',
  } = options;
  const validateStorage = options.purpose !== 'query';
  const tablesByName = new Map(
    metadata.tables.map((table) => [table.name, table]),
  );
  const indexesByTable = new Map<string, GtfsPhysicalIndexMetadata[]>();
  for (const index of metadata.indexes) {
    const indexes = indexesByTable.get(index.tableName) ?? [];
    indexes.push(index);
    indexesByTable.set(index.tableName, indexes);
  }

  const issues: GtfsTableSchemaIssue[] = [];
  for (const tablePlan of plan.tables) {
    const tableName = tablePlan.table.tableName;
    const table = tablesByName.get(tableName);
    const {
      missingColumns,
      unexpectedlyNullableColumns,
      missingDefaultColumns,
      incompatibleDefaults,
      incompatibleColumnTypes,
      incompatibleGeneratedColumns,
    } = compareTableColumns({
      plan,
      tablePlan,
      table,
      validateStorage,
      databaseGeneratesServiceTimeColumns,
    });
    const physicalIndexes = indexesByTable.get(tableName) ?? [];
    const incompatibleStorageKey =
      validateStorage &&
      table !== undefined &&
      !isStorageKeyCompatible(tablePlan.key, physicalIndexes);
    const { missingIndexes, incompatibleIndexes } = compareTableIndexes({
      dialect: plan.dialect,
      tablePlan,
      physicalIndexes,
      includeIndexes,
    });

    if (
      table === undefined ||
      missingColumns.length > 0 ||
      unexpectedlyNullableColumns.length > 0 ||
      missingDefaultColumns.length > 0 ||
      incompatibleColumnTypes.length > 0 ||
      incompatibleGeneratedColumns.length > 0 ||
      missingIndexes.length > 0 ||
      incompatibleDefaults.length > 0 ||
      incompatibleIndexes.length > 0 ||
      incompatibleStorageKey
    ) {
      issues.push({
        tableName,
        missingTable: table === undefined,
        missingColumns,
        unexpectedlyNullableColumns,
        missingDefaultColumns,
        missingIndexes,
        incompatibleColumnTypes,
        incompatibleGeneratedColumns,
        ...(incompatibleDefaults.length === 0 ? {} : { incompatibleDefaults }),
        ...(incompatibleIndexes.length === 0 ? {} : { incompatibleIndexes }),
        ...(incompatibleStorageKey ? { incompatibleStorageKey: true } : {}),
      });
    }
  }

  return { compatible: issues.length === 0, tableIssues: issues };
}
