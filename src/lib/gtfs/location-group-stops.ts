import type { LocationGroupStop } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { locationGroupStops } from '../../schema/tables/gtfs-schedule/location-group-stops.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all location group stops that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
