import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import areas from '../../models/gtfs/areas.js';

/*
 * Returns an array of all areas that match the query parameters.
 */
export function getAreas(query = {}, fields = [], orderBy = [], options = {}) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(areas.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
    )
    .all();
}
