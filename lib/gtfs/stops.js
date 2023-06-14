import { omit, orderBy, pick } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.js';
import { stopsToGeoJSON } from '../geojson-utils.js';
import stops from '../../models/gtfs/stops.js';
import { getAgencies } from './agencies.js';
import { getStopAttributes } from '../gtfs-plus/stop-attributes.js';

function buildTripSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT trip_id FROM trips ${whereClause}`;
}

function buildStoptimeSubquery(query) {
  return `SELECT DISTINCT stop_id FROM stop_times WHERE trip_id IN (${buildTripSubquery(
    query
  )})`;
}

/*
 * Returns an array of stops that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a
 * direction.
 */
export function getStops(query = {}, fields = [], orderBy = [], options = {}) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(stops.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const stopQuery = omit(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
    'shape_id',
  ]);
  const tripQuery = pick(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
    'shape_id',
  ]);

  const whereClauses = Object.entries(stopQuery).map(([key, value]) =>
    formatWhereClause(key, value)
  );

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`stop_id IN (${buildStoptimeSubquery(tripQuery)})`);
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

/*
 * Returns geoJSON with stops.  A `route_id` query parameter may be passed to
 * find all shapes for a route. A `trip_id` query parameter may be passed to
 * find all shapes for a trip. A `direction_id` query parameter may be passed
 * to find all shapes for a direction.
 */
export function getStopsAsGeoJSON(query = {}, options = {}) {
  const db = options.db ?? openDb();
  const stops = getStops(query, [], [], options);

  // Get all agencies for reference
  const agencies = getAgencies({}, [], [], options);

  const preparedStops = stops.map((stop) => {
    const routeSubquery =
      'SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE stop_id = ?)';
    const routes = db
      .prepare(`SELECT * FROM routes WHERE route_id IN (${routeSubquery})`)
      .all(stop.stop_id);

    const stopAttributes = getStopAttributes({ stop_id: stop.stop_id });

    stop.routes = orderBy(routes, (route) =>
      Number.parseInt(route.route_short_name, 10)
    );
    stop.agency_name = agencies[0].agency_name;

    return {
      ...stop,
      ...(stopAttributes?.[0] || []),
    };
  });

  // Exclude stops not part of any route
  const filteredStops = preparedStops.filter((stop) => stop.routes.length > 0);

  return stopsToGeoJSON(filteredStops);
}
