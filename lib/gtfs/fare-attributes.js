import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClauses } from '../utils.js';
import fareAttributes from '../../models/gtfs/fare-attributes.js';

/*
 * Returns an array of all fare attributes that match the query parameters.
 */
export async function getFareAttributes(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(fareAttributes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}
