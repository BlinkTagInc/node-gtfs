import sqlString from 'sqlstring-sqlite';

import { openDb } from './db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
  formatJoinClause,
} from './utils.js';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export function advancedQuery(table, advancedQueryOptions) {
  const defaultOptions = {
    query: {},
    fields: [],
    orderBy: [],
    join: [],
    options: {},
  };
  const queryOptions = { ...defaultOptions, ...advancedQueryOptions };

  const db = queryOptions.options.db ?? openDb();
  const tableName = sqlString.escapeId(table);
  const selectClause = formatSelectClause(queryOptions.fields);
  const whereClause = formatWhereClauses(queryOptions.query);
  const joinClause = formatJoinClause(queryOptions.join);
  const orderByClause = formatOrderByClause(queryOptions.orderBy);
  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${orderByClause};`
    )
    .all();
}
