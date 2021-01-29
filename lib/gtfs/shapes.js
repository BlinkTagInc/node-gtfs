const {
  omit,
  pick
} = require('lodash');
const sqlString = require('sqlstring-sqlite');
const { featureCollection } = require('@turf/helpers');

const { getDb } = require('../db');

const {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses
} = require('../utils');
const geojsonUtils = require('../geojson-utils');
const shapesModel = require('../../models/gtfs/shapes');
const { getAgencies } = require('./agencies');
const { getRoutes } = require('./routes');

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
exports.getShapes = async (query = {}, fields = [], orderBy = []) => {
  const db = await getDb();
  const tableName = sqlString.escapeId(shapesModel.filenameBase);
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
};

/*
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route.
 */
exports.getShapesAsGeoJSON = async (query = {}) => {
  const agencies = await getAgencies();
  const agencyName = agencies.length > 0 ? agencies[0].agency_name : undefined;

  const routeQuery = {};

  if (query.route_id !== undefined) {
    routeQuery.route_id = query.route_id;
  }

  const routes = await getRoutes(routeQuery);
  const features = [];

  await Promise.all(routes.map(async route => {
    const shapeQuery = { route_id: route.route_id, ...omit(query, 'route_id') };
    const shapes = await exports.getShapes(shapeQuery, ['shape_id', 'shape_pt_sequence', 'shape_pt_lon', 'shape_pt_lat']);

    const routeProperties = {
      agency_name: agencyName,
      ...route
    };
    features.push(...geojsonUtils.shapesToGeoJSONFeatures(shapes, routeProperties));
  }));

  return featureCollection(features);
};
