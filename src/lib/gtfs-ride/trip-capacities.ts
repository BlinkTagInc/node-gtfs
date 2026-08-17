import type { TripCapacity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripCapacity } from '../../schema/tables/gtfs-ride/trip-capacity.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all trip-capacities that match the query parameters.
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
