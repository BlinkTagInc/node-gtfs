import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import fareMedia from '../../models/gtfs/fare-media.js';

/*
 * Returns an array of all fare media that match the query parameters.
 */
export function getFareMedia(
  query = {},
  fields = [],
  orderBy = [],
  options = {},
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(fareMedia.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all();
}
