import type { Direction } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { directions } from '../../schema/tables/gtfs-plus/directions.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all directions that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getDirections<Fields extends keyof Direction>(
  query: RowQuery<Direction> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Direction> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Direction, Fields>(
    directions,
    query,
    fields,
    orderBy,
    options,
  );
}
