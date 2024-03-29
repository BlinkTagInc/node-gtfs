import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import timeframes from '../../models/gtfs/timeframes.js';

/*
 * Returns an array of all timeframes that match the query parameters.
 */
export function getTimeframes(
  query = {},
  fields = [],
  orderBy = [],
  options = {},
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(timeframes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all();
}
