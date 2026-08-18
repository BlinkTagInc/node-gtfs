import type { Location } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { locations } from '../../schema/tables/gtfs-schedule/locations.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all locations that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getLocations<Fields extends keyof Location>(
  query: RowQuery<Location> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Location> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Location, Fields>(locations, query, fields, orderBy, options);
}
