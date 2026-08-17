import type { GtfsTableDefinition } from '../schema/define-table.ts';
import { getTableName } from '../schema/compile-table.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../types/query.ts';
import { openDb } from './db.ts';
import {
  escapeIdentifier,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from './utils.ts';

export interface GtfsReadSpec<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
> {
  where: RowQuery<Row>;
  select: readonly Fields[];
  orderBy: RowOrderBy<Row>;
  limit?: number;
  offset?: number;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

/** Executes a read specification against SQLite. */
export function executeSqliteRead<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
>(
  definition: GtfsTableDefinition,
  spec: GtfsReadSpec<Row, Fields>,
  options: SqliteQueryOptions,
): SelectedRow<Row, Fields>[] {
  const db = options.db ?? openDb();
  const tableName = escapeIdentifier(getTableName(definition));
  const selectClause = formatSelectClause(spec.select);
  const { clause: whereClause, params } = formatWhereClauses(
    spec.where as DynamicQuery,
  );
  const orderByClause = formatOrderByClause(spec.orderBy);
  const limitClause =
    spec.limit === undefined
      ? ''
      : `LIMIT ${nonNegativeInteger(spec.limit, 'limit')}`;
  const offsetClause =
    spec.offset === undefined
      ? ''
      : `OFFSET ${nonNegativeInteger(spec.offset, 'offset')}`;

  if (offsetClause && !limitClause) {
    throw new TypeError('offset requires limit');
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause} ${limitClause} ${offsetClause};`,
    )
    .all(...params) as SelectedRow<Row, Fields>[];
}
