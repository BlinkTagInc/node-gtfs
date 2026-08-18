import type { Ridership } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { ridership } from '../../schema/tables/gtfs-ride/ridership.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all ridership that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRidership<Fields extends keyof Ridership>(
  query: RowQuery<Ridership> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Ridership> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Ridership, Fields>(
    ridership,
    query,
    fields,
    orderBy,
    options,
  );
}
