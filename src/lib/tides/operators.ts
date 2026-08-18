import type { Operator } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { operators } from '../../schema/tables/tides/operators.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all operators that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getOperators<Fields extends keyof Operator>(
  query: RowQuery<Operator> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Operator> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Operator, Fields>(operators, query, fields, orderBy, options);
}
