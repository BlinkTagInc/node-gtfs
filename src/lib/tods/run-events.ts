import type { RunEvent } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { runEvents } from '../../schema/tables/tods/run-events.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all run events that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRunEvents<Fields extends keyof RunEvent>(
  query: RowQuery<RunEvent> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RunEvent> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RunEvent, Fields>(runEvents, query, fields, orderBy, options);
}
