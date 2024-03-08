import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import trips from '../../models/gtfs/trips.js';

/*
 * Returns an array of all trips that match the query parameters.
 */
export function getTrips(query = {}, fields = [], orderBy = [], options = {}) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(trips.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
    )
    .all();
}
