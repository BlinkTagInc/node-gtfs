import type {
  LocationGroupStop,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { locationGroupStops } from '../../models/gtfs/location-group-stops.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all location group stops that match the query parameters.
 */
export function getLocationGroupStops<Fields extends keyof LocationGroupStop>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<LocationGroupStop, Fields>(
    locationGroupStops,
    query,
    fields,
    orderBy,
    options,
  );
}
