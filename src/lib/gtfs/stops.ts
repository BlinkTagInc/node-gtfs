import { omit, orderBy, pick } from 'lodash-es';
import { FeatureCollection } from 'geojson';

import type {
  QueryOptions,
  SqlBindValue,
  SqlClause,
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

function buildTripSubquery(query: { [key: string]: SqlValue }): SqlClause {
  const { clause: whereClause, params } = formatWhereClauses(query);
  return { clause: `SELECT trip_id FROM trips ${whereClause}`, params };
}

function buildStoptimeSubquery(query: { [key: string]: SqlValue }): SqlClause {
  const tripSubquery = buildTripSubquery(query);
  return {
    clause: `SELECT DISTINCT stop_id FROM stop_times WHERE trip_id IN (${tripSubquery.clause})`,
    params: tripSubquery.params,
  };
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

  // Parameters for the ORDER BY clause bind after the WHERE parameters, since
  // ORDER BY comes later in the statement.
  const orderByParams: SqlBindValue[] = [];

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
      orderByClause =
        'ORDER BY (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) ASC';
      const lat = Number(query.stop_lat);
      const lon = Number(query.stop_lon);
      orderByParams.push(lat, lat, lon, lon);
    }
  }

  if (Object.values(tripQuery).length > 0) {
    const stoptimeSubquery = buildStoptimeSubquery(tripQuery);
    whereClauses.push({
      clause: `stop_id IN (${stoptimeSubquery.clause})`,
      params: stoptimeSubquery.params,
    });
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(
      ...whereClauses.flatMap(({ params }) => params),
      ...orderByParams,
    ) as QueryResult<Stop, Fields>[];
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
      agency_name: agencies[0]?.agency_name ?? null,
    };
  });

  // Exclude stops not part of any route
  const filteredStops = preparedStops.filter((stop) => stop.routes.length > 0);

  return stopsToGeoJSONFeatureCollection(filteredStops);
}
