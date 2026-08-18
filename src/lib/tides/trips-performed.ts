import type { TripPerformed } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripsPerformed } from '../../schema/tables/tides/trips-performed.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all performed trips that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTripsPerformed<Fields extends keyof TripPerformed>(
  query: RowQuery<TripPerformed> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TripPerformed> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TripPerformed, Fields>(
    tripsPerformed,
    query,
    fields,
    orderBy,
    options,
  );
}
