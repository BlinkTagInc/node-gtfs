import { omit, orderBy, pick } from 'lodash-es';
import { FeatureCollection } from 'geojson';

import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  Stop,
  SqlValue,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauseBoundingBox,
  formatWhereClauses,
} from '../utils.ts';
import { stopsToGeoJSONFeatureCollection } from '../geojson-utils.ts';
import { getAgencies } from './agencies.ts';
import { getStopAttributes } from '../gtfs-plus/stop-attributes.ts';

function buildTripSubquery(query: { [key: string]: SqlValue }) {
  const whereClause = formatWhereClauses(query);
  return `SELECT trip_id FROM trips ${whereClause}`;
}

function buildStoptimeSubquery(query: { [key: string]: SqlValue }) {
  return `SELECT DISTINCT stop_id FROM stop_times WHERE trip_id IN (${buildTripSubquery(
    query,
  )})`;
}

/*
 * Returns an array of stops that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a
 * direction.
 */
export function getStops<Fields extends keyof Stop>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'stops';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  let orderByClause = formatOrderByClause(orderBy);

  const stopQueryOmitKeys = [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
    'shape_id',
  ];

  // If bounding_box_side_m is defined, search for stops inside a bounding box so omit `stop_lat` and `stop_lon`.
  if (options.bounding_box_side_m !== undefined) {
    stopQueryOmitKeys.push('stop_lat', 'stop_lon');
  }

  const stopQuery = omit(query, stopQueryOmitKeys);

  const tripQuery = pick(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
    'shape_id',
  ]) as {
    route_id?: string;
    trip_id?: string;
    service_id?: string;
    direction_id?: number;
    shape_id?: string;
  };

  const whereClauses = Object.entries(stopQuery).map(([key, value]) =>
    formatWhereClause(key, value as SqlValue),
  );

  if (
    options.bounding_box_side_m !== undefined &&
    query.stop_lat !== undefined &&
    query.stop_lon !== undefined
  ) {
    whereClauses.push(
      formatWhereClauseBoundingBox(
        query.stop_lat as number | string,
        query.stop_lon as number | string,
        options.bounding_box_side_m,
      ),
    );

    // Add distance-based sorting if bounding_box_side_m is set and no other orderBy is set
    if (orderBy.length === 0) {
      orderByClause = `ORDER BY (((stop_lat - ${query.stop_lat}) * (stop_lat - ${query.stop_lat})) + ((stop_lon - ${query.stop_lon}) * (stop_lon - ${query.stop_lon}))) ASC`;
    }
  }

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`stop_id IN (${buildStoptimeSubquery(tripQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<Stop, Fields>[];
}

/*
 * Returns geoJSON with stops.  A `route_id` query parameter may be passed to
 * find all shapes for a route. A `trip_id` query parameter may be passed to
 * find all shapes for a trip. A `direction_id` query parameter may be passed
 * to find all shapes for a direction.
 */
export function getStopsAsGeoJSON(
  query: SqlWhere = {},
  options: QueryOptions = {},
): FeatureCollection {
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

    return {
      ...stop,
      ...(stopAttributes?.[0] || []),
      routes: orderBy(routes, (route: { route_short_name?: string }) =>
        route?.route_short_name
          ? Number.parseInt(route.route_short_name, 10)
          : 0,
      ),
      agency_name: agencies[0].agency_name,
    };
  });

  // Exclude stops not part of any route
  const filteredStops = preparedStops.filter((stop) => stop.routes.length > 0);

  return stopsToGeoJSONFeatureCollection(filteredStops);
}
