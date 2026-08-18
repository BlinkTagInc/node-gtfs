import type { GtfsTableDefinition } from '../schema/define-table.ts';
import { getTableName } from '../schema/compile-table.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../types/query.ts';
import { openDb } from './sqlite-db.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';
import {
  combineWhereClauses,
  escapeIdentifier,
  formatOrderByClause,
  formatSelectClause,
  formatWhereConditions,
  type SqlClause,
} from './sql-clauses.ts';

interface SelectRowsSpec<Row extends object, Fields> {
  /** Columns to select, or every column when empty. */
  fields: readonly Fields[];
  /** Bare conditions combined with `AND`. */
  where: readonly SqlClause[];
  orderBy: RowOrderBy<Row>;
  /**
   * Replaces the ORDER BY clause generated from `orderBy`. Its parameters bind
   * after the WHERE parameters, matching their order in the statement.
   */
  orderByOverride?: SqlClause;
}

/** Selects rows of one table from SQLite. */
export function selectRows<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
>(
  tableName: string,
  spec: SelectRowsSpec<Row, Fields>,
  options: SqliteQueryOptions,
): SelectedRow<Row, Fields>[] {
  const db = options.db ?? openDb();
  const selectClause = formatSelectClause(spec.fields);
  const { clause: whereClause, params } = combineWhereClauses(spec.where);
  const orderByClause =
    spec.orderByOverride?.clause ?? formatOrderByClause(spec.orderBy);
  const orderByParams = spec.orderByOverride?.params ?? [];

  return db
    .prepare(
      `${selectClause} FROM ${escapeIdentifier(tableName)} ${whereClause} ${orderByClause};`,
    )
    .all(...params, ...orderByParams) as SelectedRow<Row, Fields>[];
}

/** Reads the rows of a single GTFS table from SQLite. */
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
  const tableName = getTableName(definition);

  return selectRows<Row, Fields>(
    tableName,
    {
      fields,
      where: formatWhereConditions(query as DynamicQuery, tableName),
      orderBy,
    },
    options,
  );
}

export function requireQueryType(
  field: string,
  value: unknown,
  expected: 'number',
  format: string,
): number;
export function requireQueryType(
  field: string,
  value: unknown,
  expected: 'string',
  format: string,
): string;
/** Rejects a query parameter that is not of the type its format requires. */
export function requireQueryType(
  field: string,
  value: unknown,
  expected: 'number' | 'string',
  format: string,
): number | string {
  if (typeof value !== expected) {
    throw new GtfsError(
      `\`${field}\` must be a ${expected} in ${format} format`,
      {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.QUERY,
        details: { field, value },
      },
    );
  }

  return value as number | string;
}
