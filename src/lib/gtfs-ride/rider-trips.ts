import type {
  RiderTrip,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { riderTrip } from '../../schema/tables/gtfs-ride/rider-trip.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all rider trips that match the query parameters.
 */
export function getRiderTrips<Fields extends keyof RiderTrip>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RiderTrip, Fields>(
    riderTrip,
    query,
    fields,
    orderBy,
    options,
  );
}
