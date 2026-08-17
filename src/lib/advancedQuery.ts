import { openDb } from './db.ts';

import {
  escapeIdentifier,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
  formatJoinClause,
} from './utils.ts';

import type {
  AdvancedQueryOptions,
  DynamicQuery,
  DynamicQueryResult,
} from '../types/query.ts';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export function advancedQuery(
  table: string,
  advancedQueryOptions: AdvancedQueryOptions,
) {
  const defaultOptions = {
    query: {},
    fields: [],
    orderBy: [],
    join: [],
  } satisfies Required<Omit<AdvancedQueryOptions, 'db'>>;
  const queryOptions = { ...defaultOptions, ...advancedQueryOptions };

  const db = queryOptions.db ?? openDb();
  const tableName = escapeIdentifier(table);
  const selectClause = formatSelectClause(queryOptions.fields);
  const { clause: whereClause, params } = formatWhereClauses(
    queryOptions.query as DynamicQuery,
  );
  const joinClause = formatJoinClause(queryOptions.join);
  const orderByClause = formatOrderByClause(queryOptions.orderBy);
  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as DynamicQueryResult[];
}
