import type { LocationGroup } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { locationGroups } from '../../schema/tables/gtfs-schedule/location-groups.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all location groups that match the query parameters.
 */
export function getLocationGroups<Fields extends keyof LocationGroup>(
  query: RowQuery<LocationGroup> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<LocationGroup> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<LocationGroup, Fields>(
    locationGroups,
    query,
    fields,
    orderBy,
    options,
  );
}
