import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClauses } from '../utils.js';
import stopTimes from '../../models/gtfs/stop-times.js';

/*
 * Returns an array of stoptimes that match the query parameters.
 */
export async function getStoptimes(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(stopTimes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}
