import type { RouteAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { routeAttributes } from '../../schema/tables/gtfs-plus/route-attributes.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all route_attributes that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
