import sqlString from 'sqlstring-sqlite';

import { getDb } from './db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
  formatJoinClause,
} from './utils.js';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export async function advancedQuery(table, advancedQueryOptions) {
  const defaultOptions = {
    query: {},
    fields: [],
    orderBy: [],
    join: [],
    options: {},
  };
  const queryOptions = { ...defaultOptions, ...advancedQueryOptions };

  const db = queryOptions.options.db ?? (await getDb());
  const tableName = sqlString.escapeId(table);
  const selectClause = formatSelectClause(queryOptions.fields);
  const whereClause = formatWhereClauses(queryOptions.query);
  const joinClause = formatJoinClause(queryOptions.join);
  const orderByClause = formatOrderByClause(queryOptions.orderBy);
  const sqlStatement = `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${orderByClause};`;
  return db.all(sqlStatement).catch((error) => {
    console.log(error);
  });
}

export async function runRawQuery(sql, options = {}) {
  const db = options.db ?? (await getDb());
  return db.all(sql);
}

export async function execRawQuery(sql, options = {}) {
  const db = options.db ?? (await getDb());
  return db.exec(sql);
}
