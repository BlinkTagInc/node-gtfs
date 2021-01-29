const {
  omit,
  orderBy,
  pick
} = require('lodash');
const sqlString = require('sqlstring-sqlite');

const { getDb } = require('../db');

const {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses
} = require('../utils');
const geojsonUtils = require('../geojson-utils');
const stopsModel = require('../../models/gtfs/stops');
const { getAgencies } = require('./agencies');

function buildTripSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT trip_id FROM trips ${whereClause}`;
}

function buildStoptimeSubquery(query) {
  return `SELECT DISTINCT stop_id FROM stop_times WHERE trip_id IN (${buildTripSubquery(query)})`;
}

/*
 * Returns an array of stops that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a direction.
 */
exports.getStops = async (query = {}, fields = [], orderBy = []) => {
  const db = await getDb();
  const tableName = sqlString.escapeId(stopsModel.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const stopQuery = omit(query, ['route_id', 'trip_id', 'service_id', 'direction_id']);
  const tripQuery = pick(query, ['route_id', 'trip_id', 'service_id', 'direction_id']);

  const whereClauses = Object.entries(stopQuery).map(([key, value]) => formatWhereClause(key, value));

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`stop_id IN (${buildStoptimeSubquery(tripQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
};

/*
 * Returns geoJSON with stops for the `agencyKey` specified, optionally limited
 * to the `stopIds` specified
 */
exports.getStopsAsGeoJSON = async (query = {}) => {
  const db = await getDb();
  const stops = await exports.getStops(query);

  // Get all agencies for reference
  const agencies = await getAgencies();

  const preparedStops = await Promise.all(stops.map(async stop => {
    const routeSubquery = 'SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE stop_id = ?)';
    const routes = await db.all(`SELECT * FROM routes WHERE route_id IN (${routeSubquery})`, [stop.stop_id]);

    stop.routes = orderBy(routes, route => Number.parseInt(route.route_short_name, 10));
    stop.agency_name = agencies[0].agency_name;

    return stop;
  }));

  return geojsonUtils.stopsToGeoJSON(preparedStops);
};
