import type { LocationGroupStop } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { locationGroupStops } from '../../schema/tables/gtfs-schedule/location-group-stops.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all location group stops that match the query parameters.
 */
export function getLocationGroupStops<Fields extends keyof LocationGroupStop>(
  query: RowQuery<LocationGroupStop> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<LocationGroupStop> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<LocationGroupStop, Fields>(
    locationGroupStops,
    query,
    fields,
    orderBy,
    options,
  );
}
