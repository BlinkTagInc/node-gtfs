import type {
  TripUpdate,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { tripUpdates } from '../../schema/tables/gtfs-realtime/trip-updates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all trip updates that match the query parameters.
 */
export function getTripUpdates<Fields extends keyof TripUpdate>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TripUpdate, Fields>(
    tripUpdates,
    query,
    fields,
    orderBy,
    options,
  );
}
