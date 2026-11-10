import { sql, type RawBuilder } from 'kysely';
import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import { compiledTables } from '../schema/table-registry.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';
import { isPlainObject } from '../config/options.ts';

export type DynamicRepositoryWhere = Readonly<Record<string, unknown>>;

export function joinFilterConditions(
  conditions: readonly RawBuilder<boolean>[],
): RawBuilder<boolean> {
  return conditions.length === 0
    ? sql<boolean>`1 = 1`
    : sql<boolean>`(${sql.join(conditions, sql` and `)})`;
}

export interface RepositoryFilterCompileContext {
  relatedTables: Map<string, CompiledGtfsTable>;
  requiredColumns: Map<string, Set<string>>;
}

const tableByName = new Map(
  compiledTables.map((table) => [table.tableName, table] as const),
);

export function requireFilterObject(
  value: unknown,
  {
    tableName,
    fieldName,
    description,
  }: {
    tableName: string;
    fieldName: string;
    description: string;
  },
): DynamicRepositoryWhere {
  if (!isPlainObject(value)) {
    throw createGtfsQueryError(`\`${fieldName}\` must be ${description}`, {
      table: tableName,
      field: fieldName,
      value,
    });
  }
  return value as DynamicRepositoryWhere;
}

export function registerRelatedTable(
  context: RepositoryFilterCompileContext,
  tableName: string,
): CompiledGtfsTable {
  const table = tableByName.get(tableName);
  if (table === undefined) {
    throw createGtfsQueryError(
      `Unknown related GTFS table ${JSON.stringify(tableName)}`,
      { table: tableName },
    );
  }
  context.relatedTables.set(tableName, table);
  return table;
}
