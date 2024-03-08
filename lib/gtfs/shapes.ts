import { omit, pick } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';
import { featureCollection } from '@turf/helpers';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.js';
import { shapesToGeoJSONFeatures } from '../geojson-utils.js';
import shapes from '../../models/gtfs/shapes.js';
import { getAgencies } from './agencies.js';
import { getRoutes } from './routes.js';
import { getRouteAttributes } from '../gtfs-plus/route-attributes.js';

function buildTripSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT shape_id FROM trips ${whereClause}`;
}

/*
 * Returns array of shapes that match the query parameters. A `route_id` query
 * parameter may be passed to find all shapes for a route. A `trip_id` query
 * parameter may be passed to find all shapes for a trip. A `direction_id`
 * query parameter may be passed to find all shapes for a direction.
 */
export function getShapes(query = {}, fields = [], orderBy = [], options = {}) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(shapes.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const shapeQuery = omit(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
  ]);
  const tripQuery = pick(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
  ]);

  const whereClauses = Object.entries(shapeQuery).map(([key, value]) =>
    formatWhereClause(key, value)
  );

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`shape_id IN (${buildTripSubquery(tripQuery)})`);
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
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a direction.
 */
export function getShapesAsGeoJSON(query = {}, options = {}) {
  const agencies = getAgencies({}, [], [], options);

  const routeQuery = {};

  if (query.route_id !== undefined) {
    routeQuery.route_id = query.route_id;
  }

  const routes = getRoutes(routeQuery, [], [], options);
  const features = [];

  for (const route of routes) {
    const shapeQuery = {
      route_id: route.route_id,
      ...omit(query, 'route_id'),
    };
    const shapes = getShapes(
      shapeQuery,
      ['shape_id', 'shape_pt_sequence', 'shape_pt_lon', 'shape_pt_lat'],
      [],
      options
    );
    const routeAttributes = getRouteAttributes(
      { route_id: route.route_id },
      [],
      [],
      options
    );

    const agency = agencies.find(
      (agency) => agency.agency_id === route.agency_id
    );

    const geojsonProperties = {
      agency_name: agency ? agency.agency_name : undefined,
      shape_id: query.shape_id,
      ...route,
      ...(routeAttributes?.[0] || []),
    };
    features.push(...shapesToGeoJSONFeatures(shapes, geojsonProperties));
  }

  return featureCollection(features);
}
