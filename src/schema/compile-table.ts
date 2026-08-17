import type {
  GtfsFieldDefinition,
  GtfsTableDefinition,
} from './define-table.ts';

export type CompiledGtfsColumn = GtfsFieldDefinition & {
  name: string;
  storageKind: 'text' | 'integer' | 'real' | 'json' | 'date' | 'time';
  primaryKey: boolean;
  sqlMinimum?: number;
  sqlMaximum?: number;
};

export type CompiledGtfsTable = GtfsTableDefinition & {
  name: string;
  columns: CompiledGtfsColumn[];
};

export interface GtfsIndexPlan {
  singleColumnIndexes: string[];
  compositeIndexes: string[][];
}

function storageKind(
  field: GtfsFieldDefinition,
): CompiledGtfsColumn['storageKind'] {
  if (field.kind === 'id') return 'text';
  if (field.kind === 'enumeration') {
    return typeof field.values[0] === 'number' ? 'integer' : 'text';
  }
  return field.kind;
}

export function getTableName(definition: GtfsTableDefinition): string {
  if (definition.file === null) return definition.table;
  const extensionIndex = definition.file.lastIndexOf('.');
  return extensionIndex === -1
    ? definition.file
    : definition.file.slice(0, extensionIndex);
}

export function compileTable(
  definition: GtfsTableDefinition,
): CompiledGtfsTable {
  const primaryFields = new Set<string>(definition.primaryKey ?? []);
  const columns = Object.entries(definition.fields).map(([name, field]) => {
    return {
      ...field,
      name,
      storageKind: storageKind(field),
      primaryKey: primaryFields.has(name),
      sqlMinimum: field.minimum,
      sqlMaximum: field.maximum,
    } satisfies CompiledGtfsColumn;
  });

  const compiled: CompiledGtfsTable = {
    ...definition,
    name: getTableName(definition),
    columns,
  };
  return compiled;
}

export function getTimestampColumnName(columnName: string): string {
  return columnName.endsWith('time')
    ? `${columnName}stamp`
    : `${columnName}_timestamp`;
}

export function getGtfsIndexPlan(
  table: CompiledGtfsTable,
  options: { includeGeneratedTimeIndexes: boolean },
): GtfsIndexPlan {
  const singleColumnIndexes = new Set<string>();
  const compositeIndexes: string[][] = [];

  for (const configuredIndex of table.storage?.indexes ?? []) {
    const columns =
      typeof configuredIndex === 'string'
        ? [configuredIndex]
        : [...configuredIndex];
    if (columns.length === 0) {
      continue;
    } else if (columns.length === 1) {
      singleColumnIndexes.add(columns[0]);
    } else {
      compositeIndexes.push(columns);
    }
  }

  if (options.includeGeneratedTimeIndexes) {
    for (const column of table.columns) {
      if (column.storageKind === 'time') {
        singleColumnIndexes.add(getTimestampColumnName(column.name));
      }
    }
  }

  return {
    singleColumnIndexes: [...singleColumnIndexes],
    compositeIndexes,
  };
}
