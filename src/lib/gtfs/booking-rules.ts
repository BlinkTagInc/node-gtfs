import type { BookingRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { bookingRules } from '../../schema/tables/gtfs-schedule/booking-rules.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all booking rules that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getBookingRules<Fields extends keyof BookingRule>(
  query: RowQuery<BookingRule> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<BookingRule> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<BookingRule, Fields>(
    bookingRules,
    query,
    fields,
    orderBy,
    options,
  );
}
