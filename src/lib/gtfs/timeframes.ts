import type { Timeframe } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timeframes } from '../../schema/tables/gtfs-schedule/timeframes.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all timeframes that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTimeframes<Fields extends keyof Timeframe>(
  query: RowQuery<Timeframe> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Timeframe> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Timeframe, Fields>(
    timeframes,
    query,
    fields,
    orderBy,
    options,
  );
}
