import type { Deadhead } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { deadheads } from '../../schema/tables/tods/deadheads.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all deadheads that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getDeadheads<Fields extends keyof Deadhead>(
  query: RowQuery<Deadhead> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Deadhead> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Deadhead, Fields>(deadheads, query, fields, orderBy, options);
}
