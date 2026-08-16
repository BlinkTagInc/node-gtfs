import type {
  LocationGroup,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { locationGroups } from '../../schema/tables/gtfs-schedule/location-groups.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all location groups that match the query parameters.
 */
export function getLocationGroups<Fields extends keyof LocationGroup>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<LocationGroup, Fields>(
    locationGroups,
    query,
    fields,
    orderBy,
    options,
  );
}
