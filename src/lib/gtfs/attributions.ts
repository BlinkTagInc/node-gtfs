import type { Attribution } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { attributions } from '../../schema/tables/gtfs-schedule/attributions.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all attributions that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getAttributions<Fields extends keyof Attribution>(
  query: RowQuery<Attribution> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Attribution> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Attribution, Fields>(
    attributions,
    query,
    fields,
    orderBy,
    options,
  );
}
