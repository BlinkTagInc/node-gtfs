import type { RouteNetwork } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { routeNetworks } from '../../schema/tables/gtfs-schedule/route-networks.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all route_networks that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
