import { omit, pick } from 'lodash-es';

import type {
  QueryOptions,
  Route,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.ts';

function buildStoptimeSubquery(query: { [key: string]: string }) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT trip_id FROM stop_times ${whereClause}`;
}

function buildTripSubquery(query: { service_id?: string; stop_id?: string }) {
  let whereClause = '';
  const tripQuery = omit(query, ['stop_id']);
  const stoptimeQuery = pick(query, ['stop_id']);

  const whereClauses = Object.entries(tripQuery).map(([key, value]) =>
    formatWhereClause(key, value),
  );

  if (Object.values(stoptimeQuery).length > 0) {
    whereClauses.push(`trip_id IN (${buildStoptimeSubquery(stoptimeQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return `SELECT DISTINCT route_id FROM trips ${whereClause}`;
}

/*
 * Returns an array of routes that match the query parameters. A `stop_id`
 * query parameter may be passed to find all routes that contain that stop.
 * A `service_id` query parameter may be passed to limit routes to specific
 * calendars.
 */
export function getRoutes<Fields extends keyof Route>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'routes';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);
  const routeQuery = omit(query, ['stop_id', 'service_id']);
  const tripQuery = pick(query, ['stop_id', 'service_id']) as {
    stop_id?: string;
    service_id?: string;
  };

  const whereClauses = Object.entries(routeQuery).map(([key, value]) =>
    formatWhereClause(key, value),
  );

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`route_id IN (${buildTripSubquery(tripQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<Route, Fields>[];
}
