import sqlString from 'sqlstring-sqlite';
import Database from 'better-sqlite3';

import { openDb } from './db.ts';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
  formatJoinClause,
} from './utils.ts';

import type {
  JoinOptions,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
  SqlValue,
} from '../types/global_interfaces.ts';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export function advancedQuery(
  table: string,
  advancedQueryOptions: {
    db?: Database.Database;
    query?: SqlWhere;
    fields?: string[];
    orderBy?: SqlOrderBy;
    join?: JoinOptions[];
    options?: QueryOptions;
  },
) {
  const defaultOptions: {
    query: SqlWhere;
    fields: string[];
    orderBy: SqlOrderBy;
    join: JoinOptions[];
    options: QueryOptions;
  } = {
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
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${orderByClause};`,
    )
    .all() as Array<Record<string, SqlValue>>;
}
