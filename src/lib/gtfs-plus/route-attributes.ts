import type {
  RouteAttribute,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { routeAttributes } from '../../schema/tables/gtfs-plus/route-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all route_attributes that match the query parameters.
 */
export function getRouteAttributes<Fields extends keyof RouteAttribute>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RouteAttribute, Fields>(
    routeAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
