import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import routeAttributes from '../../models/gtfs-plus/route-attributes.js';

/*
 * Returns an array of all route_attributes that match the query parameters.
 */
export function getRouteAttributes(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(routeAttributes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
    )
    .all();
}
