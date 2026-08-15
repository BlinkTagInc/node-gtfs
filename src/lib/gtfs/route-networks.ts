import type {
  RouteNetwork,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { routeNetworks } from '../../models/gtfs/route-networks.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all route_networks that match the query parameters.
 */
export function getRouteNetworks<Fields extends keyof RouteNetwork>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RouteNetwork, Fields>(
    routeNetworks,
    query,
    fields,
    orderBy,
    options,
  );
}
