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
import stopAttributes from '../../models/gtfs-plus/stop-attributes.ts';

/*
 * Returns an array of all stop attributes that match the query parameters.
 */
export function getStopAttributes(
  query: SqlWhere = {},
  fields: SqlSelect = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
): SqlResults {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(stopAttributes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as SqlResults;
}
