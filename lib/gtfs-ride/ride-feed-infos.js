import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClauses } from '../utils.js';
import rideFeedInfo from '../../models/gtfs-ride/ride-feed-info.js';

/*
 * Returns an array of all ride-feed-info that match the query parameters.
 */
export async function getRideFeedInfos(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(rideFeedInfo.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}
