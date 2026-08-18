import type { DeadheadTime } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { deadheadTimes } from '../../schema/tables/tods/deadhead-times.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all deadhead times that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getDeadheadTimes<Fields extends keyof DeadheadTime>(
  query: RowQuery<DeadheadTime> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<DeadheadTime> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<DeadheadTime, Fields>(
    deadheadTimes,
    query,
    fields,
    orderBy,
    options,
  );
}
