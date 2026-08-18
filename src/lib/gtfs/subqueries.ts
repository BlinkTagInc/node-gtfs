import type { DynamicQuery } from '../../types/query.ts';
import {
  combineWhereClauses,
  formatWhereCondition,
  formatWhereConditions,
  type SqlClause,
} from '../sql-clauses.ts';

/**
 * Selects a single column from a table, filtered by bare conditions, for use
 * as the right-hand side of an `IN (...)` clause
 */
function selectColumn(
  column: string,
  tableName: string,
  conditions: readonly SqlClause[],
  { distinct = true }: { distinct?: boolean } = {},
): SqlClause {
  const { clause: whereClause, params } = combineWhereClauses(conditions);
  return {
    clause: `SELECT ${distinct ? 'DISTINCT ' : ''}${column} FROM ${tableName} ${whereClause}`,
    params,
  };
}

/** Trips matching a trips query. */
function tripIdsMatchingTrips(query: DynamicQuery): SqlClause {
  return selectColumn(
    'trip_id',
    'trips',
    formatWhereConditions(query, 'trips'),
    { distinct: false },
  );
}

/** Trips whose service runs on the given service IDs. */
export function tripIdsForServiceIds(serviceIds: readonly string[]): SqlClause {
  return selectColumn('trip_id', 'trips', [
    formatWhereCondition('service_id', serviceIds, 'trips'),
  ]);
}

/** Shapes used by the trips matching a trips query. */
export function shapeIdsForTrips(query: DynamicQuery): SqlClause {
  return selectColumn(
    'shape_id',
    'trips',
    formatWhereConditions(query, 'trips'),
  );
}

/** Stops visited by the trips matching a trips query. */
export function stopIdsForTrips(query: DynamicQuery): SqlClause {
  const trips = tripIdsMatchingTrips(query);
  return selectColumn('stop_id', 'stop_times', [
    { clause: `trip_id IN (${trips.clause})`, params: trips.params },
  ]);
}

/** Trips that call at the stops matching a stop_times query. */
function tripIdsForStoptimes(query: DynamicQuery): SqlClause {
  return selectColumn(
    'trip_id',
    'stop_times',
    formatWhereConditions(query, 'stop_times'),
  );
}

/**
 * Routes served by the trips matching a trips query. A `stop_id` key is
 * applied to stop_times rather than trips, since trips has no such column.
 */
export function routeIdsForTrips(query: {
  service_id?: string;
  stop_id?: string;
}): SqlClause {
  const { stop_id: stopId, ...tripQuery } = query;
  const conditions = formatWhereConditions(tripQuery as DynamicQuery, 'trips');

  // An explicit `stop_id: undefined` still filters, matching the behavior
  // before these subqueries were shared.
  if ('stop_id' in query) {
    const stoptimes = tripIdsForStoptimes({ stop_id: stopId } as DynamicQuery);
    conditions.push({
      clause: `trip_id IN (${stoptimes.clause})`,
      params: stoptimes.params,
    });
  }

  return selectColumn('route_id', 'trips', conditions);
}
