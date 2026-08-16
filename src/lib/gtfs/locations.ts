import type {
  Location,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { locations } from '../../schema/tables/gtfs-schedule/locations.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all locations that match the query parameters.
 */
export function getLocations<Fields extends keyof Location>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Location, Fields>(locations, query, fields, orderBy, options);
}
