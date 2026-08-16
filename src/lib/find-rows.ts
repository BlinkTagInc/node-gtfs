import type {
  QueryOptions,
  QueryResult,
  SqlOrderBy,
  SqlWhere,
} from '../types/global_interfaces.ts';
import type { GtfsTableDefinition } from '../schema/define-table.ts';
import { getTableName } from '../schema/compile-table.ts';
import { openDb } from './db.ts';
import {
  escapeIdentifier,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from './utils.ts';

export function findRows<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
>(
  definition: GtfsTableDefinition,
  query: SqlWhere,
  fields: Fields[],
  orderBy: SqlOrderBy,
  options: QueryOptions,
): QueryResult<Row, Fields>[] {
  const db = options.db ?? openDb();
  const tableName = escapeIdentifier(getTableName(definition));
  const selectClause = formatSelectClause(fields);
  const { clause: whereClause, params } = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as QueryResult<Row, Fields>[];
}
