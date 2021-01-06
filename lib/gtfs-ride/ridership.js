const sqlString = require('sqlstring');

const { getDb } = require('../db');

const {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses
} = require('../utils');
const ridershipModel = require('../../models/gtfs-ride/ridership');

/*
 * Returns an array of all ridership that match the query parameters.
 */
exports.getRidership = async (query = {}, fields = [], orderBy = []) => {
  const db = await getDb();
  const tableName = sqlString.escape(ridershipModel.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
};
