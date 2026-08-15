import type {
  TripCapacity,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { tripCapacity } from '../../models/gtfs-ride/trip-capacity.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all trip-capacities that match the query parameters.
 */
export function getTripCapacities<Fields extends keyof TripCapacity>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TripCapacity, Fields>(
    tripCapacity,
    query,
    fields,
    orderBy,
    options,
  );
}
