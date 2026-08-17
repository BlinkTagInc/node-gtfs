import type { TripUpdate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripUpdates } from '../../schema/tables/gtfs-realtime/trip-updates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all trip updates that match the query parameters.
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
