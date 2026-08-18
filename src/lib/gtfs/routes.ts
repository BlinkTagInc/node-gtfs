import { omit, pick } from 'lodash-es';

import type { Route } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../../types/query.ts';
import type { SqlClause } from '../sql-types.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.ts';

function buildStoptimeSubquery(query: { [key: string]: string }): SqlClause {
  const { clause: whereClause, params } = formatWhereClauses(
    query as DynamicQuery,
    'stop_times',
  );
  return {
    clause: `SELECT DISTINCT trip_id FROM stop_times ${whereClause}`,
    params,
  };
}

function buildTripSubquery(query: {
  service_id?: string;
  stop_id?: string;
}): SqlClause {
  let whereClause = '';
  const tripQuery = omit(query, ['stop_id']);
  const stoptimeQuery = pick(query, ['stop_id']);

  const whereClauses = Object.entries(tripQuery).map(([key, value]) =>
    formatWhereClause(key, value, 'trips'),
  );

  if (Object.values(stoptimeQuery).length > 0) {
    const stoptimeSubquery = buildStoptimeSubquery(stoptimeQuery);
    whereClauses.push({
      clause: `trip_id IN (${stoptimeSubquery.clause})`,
      params: stoptimeSubquery.params,
    });
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return {
    clause: `SELECT DISTINCT route_id FROM trips ${whereClause}`,
    params: whereClauses.flatMap(({ params }) => params),
  };
}

/*
 * Returns an array of routes that match the query parameters. A `stop_id`
 * query parameter may be passed to find all routes that contain that stop.
 * A `service_id` query parameter may be passed to limit routes to specific
 * calendars.
 */
export function getRoutes<Fields extends keyof Route>(
  query: RowQuery<
    Route & { stop_id: string | null; service_id: string | null }
  > = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Route> = [],
  options: SqliteQueryOptions = {},
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
    formatWhereClause(key, value, tableName),
  );

  if (Object.values(tripQuery).length > 0) {
    const tripSubquery = buildTripSubquery(tripQuery);
    whereClauses.push({
      clause: `route_id IN (${tripSubquery.clause})`,
      params: tripSubquery.params,
    });
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...whereClauses.flatMap(({ params }) => params)) as SelectedRow<
    Route,
    Fields
  >[];
}
