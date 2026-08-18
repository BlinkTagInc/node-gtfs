import { omit, pick } from 'lodash-es';

import type { Route } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { selectRows } from '../sqlite-query.ts';
import { formatWhereConditions } from '../sql-clauses.ts';
import { routeIdsForTrips } from './subqueries.ts';

/**
 * Returns an array of routes that match the query parameters. A `stop_id`
 * query parameter may be passed to find all routes that contain that stop.
 * A `service_id` query parameter may be passed to limit routes to specific
 * calendars.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRoutes<Fields extends keyof Route>(
  query: RowQuery<
    Route & { stop_id: string | null; service_id: string | null }
  > = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Route> = [],
  options: SqliteQueryOptions = {},
) {
  const tableName = 'routes';
  const where = formatWhereConditions(
    omit(query, ['stop_id', 'service_id']) as DynamicQuery,
    tableName,
  );
  const tripQuery = pick(query, ['stop_id', 'service_id']) as {
    stop_id?: string;
    service_id?: string;
  };

  if (Object.values(tripQuery).length > 0) {
    const routeIds = routeIdsForTrips(tripQuery);
    where.push({
      clause: `route_id IN (${routeIds.clause})`,
      params: routeIds.params,
    });
  }

  return selectRows<Route, Fields>(
    tableName,
    { fields, where, orderBy },
    options,
  );
}
