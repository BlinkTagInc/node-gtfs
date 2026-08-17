import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../types/query.ts';
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
  query: RowQuery<Row>,
  fields: readonly Fields[],
  orderBy: RowOrderBy<Row>,
  options: SqliteQueryOptions,
): SelectedRow<Row, Fields>[] {
  const db = options.db ?? openDb();
  const tableName = escapeIdentifier(getTableName(definition));
  const selectClause = formatSelectClause(fields);
  const { clause: whereClause, params } = formatWhereClauses(
    query as DynamicQuery,
  );
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as SelectedRow<Row, Fields>[];
}
