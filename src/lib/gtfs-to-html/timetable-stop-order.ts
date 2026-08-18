import type { TimetableStopOrder } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableStopOrder } from '../../schema/tables/gtfs-to-html/timetable-stop-order.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all timetable stop orders that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTimetableStopOrders<Fields extends keyof TimetableStopOrder>(
  query: RowQuery<TimetableStopOrder> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TimetableStopOrder> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TimetableStopOrder, Fields>(
    timetableStopOrder,
    query,
    fields,
    orderBy,
    options,
  );
}
