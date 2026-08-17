import type { BookingRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { bookingRules } from '../../schema/tables/gtfs-schedule/booking-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all booking rules that match the query parameters.
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
