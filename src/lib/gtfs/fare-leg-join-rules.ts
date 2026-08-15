import type {
  FareLegJoinRule,
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all fare leg join rules that match the query parameters.
 */
export function getFareLegJoinRules<Fields extends keyof FareLegJoinRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'fare_leg_join_rules';
  const selectClause = formatSelectClause(fields);
  const { clause: whereClause, params } = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as QueryResult<FareLegJoinRule, Fields>[];
}
