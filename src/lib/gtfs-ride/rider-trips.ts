import type { RiderTrip } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { riderTrip } from '../../schema/tables/gtfs-ride/rider-trip.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all rider trips that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRiderTrips<Fields extends keyof RiderTrip>(
  query: RowQuery<RiderTrip> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RiderTrip> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RiderTrip, Fields>(
    riderTrip,
    query,
    fields,
    orderBy,
    options,
  );
}
