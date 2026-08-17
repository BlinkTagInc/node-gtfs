import type { RunEvent } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all run_events that match the query parameters.
 */
export function getRunEvents<Fields extends keyof RunEvent>(
  query: RowQuery<RunEvent> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RunEvent> = [],
  options: SqliteQueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'run_events';
  const selectClause = formatSelectClause(fields);
  const { clause: whereClause, params } = formatWhereClauses(
    query as DynamicQuery,
  );
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as SelectedRow<RunEvent, Fields>[];
}
