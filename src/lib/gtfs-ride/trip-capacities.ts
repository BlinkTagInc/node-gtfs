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
import tripCapacity from '../../models/gtfs-ride/trip-capacity.ts';

/*
 * Returns an array of all trip-capacities that match the query parameters.
 */
export function getTripCapacities(
  query: SqlWhere = {},
  fields: SqlSelect = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
): SqlResults {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(tripCapacity.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as SqlResults;
}
