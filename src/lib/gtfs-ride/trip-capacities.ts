import type { TripCapacity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripCapacity } from '../../schema/tables/gtfs-ride/trip-capacity.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all trip-capacities that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTripCapacities<Fields extends keyof TripCapacity>(
  query: RowQuery<TripCapacity> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TripCapacity> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TripCapacity, Fields>(
    tripCapacity,
    query,
    fields,
    orderBy,
    options,
  );
}
