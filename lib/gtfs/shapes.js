import { omit, pick } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';
import { featureCollection } from '@turf/helpers';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClause, formatWhereClauses } from '../utils.js';
import { shapesToGeoJSONFeatures } from '../geojson-utils.js';
import shapes from '../../models/gtfs/shapes.js';
import { getAgencies } from './agencies.js';
import { getRoutes } from './routes.js';

function buildTripSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT shape_id FROM trips ${whereClause}`;
}

/*
 * Returns array of shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a direction.
 */
export async function getShapes(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(shapes.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const shapeQuery = omit(query, ['route_id', 'trip_id', 'service_id', 'direction_id']);
  const tripQuery = pick(query, ['route_id', 'trip_id', 'service_id', 'direction_id']);

  const whereClauses = Object.entries(shapeQuery).map(([key, value]) => formatWhereClause(key, value));

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`shape_id IN (${buildTripSubquery(tripQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}

/*
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route.
 */
export async function getShapesAsGeoJSON(query = {}) {
  const agencies = await getAgencies();

  const routeQuery = {};

  if (query.route_id !== undefined) {
    routeQuery.route_id = query.route_id;
  }

  const routes = await getRoutes(routeQuery);
  const features = [];

  await Promise.all(routes.map(async route => {
    const shapeQuery = { route_id: route.route_id, ...omit(query, 'route_id') };
    const shapes = await getShapes(shapeQuery, ['shape_id', 'shape_pt_sequence', 'shape_pt_lon', 'shape_pt_lat']);

    const agency = agencies.find(agency => agency.agency_id === route.agency_id);

    const routeProperties = {
      agency_name: agency ? agency.agency_name : undefined,
      ...route
    };
    features.push(...shapesToGeoJSONFeatures(shapes, routeProperties));
  }));

  return featureCollection(features);
}
