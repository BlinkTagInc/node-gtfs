import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';
import { isPlainObject } from '../config/options.ts';
import { assertDefinedWhereValues } from './where-validation.ts';
import { partitionRepositoryWhere } from './filter-partition.ts';

function snapshotQueryFilterValue(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): unknown {
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value) || depth > 100) {
      throw createGtfsQueryError(
        'Filter values must not contain cycles or excessive nesting',
      );
    }
    const ancestors = new Set(seen).add(value);
    if (Array.isArray(value)) {
      return Object.freeze(
        Array.from(value, (entry) =>
          snapshotQueryFilterValue(entry, ancestors, depth + 1),
        ),
      );
    }
    if (isPlainObject(value)) {
      return Object.freeze(
        Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [
            key,
            snapshotQueryFilterValue(entry, ancestors, depth + 1),
          ]),
        ),
      );
    }
  }
  return value;
}

export function resolveQueryWhere(
  table: CompiledGtfsTable,
  input: unknown,
): Readonly<Record<string, unknown>> {
  if (input === undefined) {
    assertDefinedWhereValues(input, table.tableName);
  }
  if (!isPlainObject(input)) {
    throw createGtfsQueryError('where() requires an equality object', {
      table: table.tableName,
    });
  }
  assertDefinedWhereValues(input, table.tableName);
  partitionRepositoryWhere(table, input);
  return snapshotQueryFilterValue(input) as Readonly<Record<string, unknown>>;
}
