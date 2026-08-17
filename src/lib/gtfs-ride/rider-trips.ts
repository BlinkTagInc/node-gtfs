import type { RiderTrip } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { riderTrip } from '../../schema/tables/gtfs-ride/rider-trip.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all rider trips that match the query parameters.
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
