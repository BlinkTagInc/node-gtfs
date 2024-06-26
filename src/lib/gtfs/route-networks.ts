import sqlString from 'sqlstring-sqlite';

import {
  QueryOptions,
  SqlOrderBy,
  SqlResults,
  SqlSelect,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';
import routeNetworks from '../../models/gtfs/route-networks.ts';

/*
 * Returns an array of all route_networks that match the query parameters.
 */
export function getRouteNetworks(
  query: SqlWhere = {},
  fields: SqlSelect = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
): SqlResults {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(routeNetworks.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as SqlResults;
}
