import type { RiderCategory } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { riderCategories } from '../../schema/tables/gtfs-schedule/rider-categories.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all rider categories that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRiderCategories<Fields extends keyof RiderCategory>(
  query: RowQuery<RiderCategory> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RiderCategory> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RiderCategory, Fields>(
    riderCategories,
    query,
    fields,
    orderBy,
    options,
  );
}
