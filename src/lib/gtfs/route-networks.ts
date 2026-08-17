import type { RouteNetwork } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { routeNetworks } from '../../schema/tables/gtfs-schedule/route-networks.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all route_networks that match the query parameters.
 */
export function getRouteNetworks<Fields extends keyof RouteNetwork>(
  query: RowQuery<RouteNetwork> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RouteNetwork> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RouteNetwork, Fields>(
    routeNetworks,
    query,
    fields,
    orderBy,
    options,
  );
}
