import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import stopAttributes from '../../models/gtfs-plus/stop-attributes.js';

/*
 * Returns an array of all stop attributes that match the query parameters.
 */
export function getStopAttributes(
  query = {},
  fields = [],
  orderBy = [],
  options = {},
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(stopAttributes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all();
}
