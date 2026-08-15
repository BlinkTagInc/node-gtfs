import type {
  QueryOptions,
  QueryResult,
  SqlOrderBy,
  SqlWhere,
} from '../types/global_interfaces.ts';
import { openDb } from './db.ts';
import {
  escapeIdentifier,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from './utils.ts';

interface QueryableDefinition {
  filenameBase: string;
}

export function findRows<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
>(
  definition: QueryableDefinition,
  query: SqlWhere,
  fields: Fields[],
  orderBy: SqlOrderBy,
  options: QueryOptions,
): QueryResult<Row, Fields>[] {
  const db = options.db ?? openDb();
  const tableName = escapeIdentifier(definition.filenameBase);
  const selectClause = formatSelectClause(fields);
  const { clause: whereClause, params } = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as QueryResult<Row, Fields>[];
}
