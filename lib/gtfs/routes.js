const {
  omit,
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
const routesModel = require('../../models/gtfs/routes');

function buildStoptimeSubquery(query) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT trip_id FROM stop_times ${whereClause}`;
}

function buildTripSubquery(query) {
  return `SELECT DISTINCT route_id FROM trips WHERE trip_id IN (${buildStoptimeSubquery(query)})`;
}

/*
 * Returns an array of routes that match the query parameters. A `stop_id`
 * query parameter may be passed to find all routes that contain that stop.
 */
exports.getRoutes = async (query = {}, fields = [], orderBy = []) => {
  const db = await getDb();
  const tableName = sqlString.escapeId(routesModel.filenameBase);
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const routeQuery = omit(query, ['stop_id']);
  const stoptimeQuery = pick(query, ['stop_id']);

  const whereClauses = Object.entries(routeQuery).map(([key, value]) => formatWhereClause(key, value));

  if (Object.values(stoptimeQuery).length > 0) {
    whereClauses.push(`route_id IN (${buildTripSubquery(stoptimeQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
};
