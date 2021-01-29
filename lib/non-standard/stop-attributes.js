const sqlString = require('sqlstring-sqlite');

const { getDb } = require('../db');

const {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses
} = require('../utils');
const stopAttributesModel = require('../../models/non-standard/stop-attributes');

/*
 * Returns an array of all stop attributes that match the query parameters.
 */
exports.getStopAttributes = async (query = {}, fields = [], orderBy = []) => {
  const db = await getDb();
  const tableName = sqlString.escapeId(stopAttributesModel.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
};
