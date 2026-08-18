import type { TripUpdate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripUpdates } from '../../schema/tables/gtfs-realtime/trip-updates.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all trip updates that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTripUpdates<Fields extends keyof TripUpdate>(
  query: RowQuery<TripUpdate> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TripUpdate> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TripUpdate, Fields>(
    tripUpdates,
    query,
    fields,
    orderBy,
    options,
  );
}
