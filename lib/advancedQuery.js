import sqlString from 'sqlstring-sqlite';

import { getDb } from './db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from './utils.js';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export async function advancedQuery(table, where = {},select = [],orderBy = [], join ="", options = {}) {
  const db = options.db ?? (await getDb());
  const tableName = sqlString.escapeId(table);
  const selectClause = formatSelectClause(select);
  const whereClause = formatWhereClauses(where);
  const orderByClause = formatOrderByClause(orderBy);
  const joinClause = join;
  return db.prepare(`${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${orderByClause};`).all();
}

export async function rawQuery(sql, params = [], options = {}) {
  const db = options.db ?? (await getDb());
  return db.prepare(sql).all(params);
}
