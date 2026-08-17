import type { Location } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { locations } from '../../schema/tables/gtfs-schedule/locations.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all locations that match the query parameters.
 */
export function getLocations<Fields extends keyof Location>(
  query: RowQuery<Location> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Location> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Location, Fields>(locations, query, fields, orderBy, options);
}
