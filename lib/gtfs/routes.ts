import { omit, pick } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.js';
import routes from '../../models/gtfs/routes.js';

function buildStoptimeSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT trip_id FROM stop_times ${whereClause}`;
}

function buildTripSubquery(query) {
  return `SELECT DISTINCT route_id FROM trips WHERE trip_id IN (${buildStoptimeSubquery(
    query
  )})`;
}

/*
 * Returns an array of routes that match the query parameters. A `stop_id`
 * query parameter may be passed to find all routes that contain that stop.
 */
export function getRoutes(query = {}, fields = [], orderBy = [], options = {}) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(routes.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const routeQuery = omit(query, ['stop_id']);
  const stoptimeQuery = pick(query, ['stop_id']);

  const whereClauses = Object.entries(routeQuery).map(([key, value]) =>
    formatWhereClause(key, value)
  );

  if (Object.values(stoptimeQuery).length > 0) {
    whereClauses.push(`route_id IN (${buildTripSubquery(stoptimeQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
    )
    .all();
}
