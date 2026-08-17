import type { RouteAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { routeAttributes } from '../../schema/tables/gtfs-plus/route-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all route_attributes that match the query parameters.
 */
export function getRouteAttributes<Fields extends keyof RouteAttribute>(
  query: RowQuery<RouteAttribute> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RouteAttribute> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RouteAttribute, Fields>(
    routeAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
