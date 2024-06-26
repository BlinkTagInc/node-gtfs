import sqlString from 'sqlstring-sqlite';

import {
  QueryOptions,
  SqlOrderBy,
  SqlResults,
  SqlSelect,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';
import stopTimeUpdates from '../../models/gtfs-realtime/stop-time-updates.ts';

/*
 * Returns an array of all stop time updates that match the query parameters.
 */
export function getStopTimeUpdates(
  query: SqlWhere = {},
  fields: SqlSelect = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
): SqlResults {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(stopTimeUpdates.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as SqlResults;
}
