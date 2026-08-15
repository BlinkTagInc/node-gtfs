import type {
  BookingRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { bookingRules } from '../../models/gtfs/booking-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all booking rules that match the query parameters.
 */
export function getBookingRules<Fields extends keyof BookingRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<BookingRule, Fields>(
    bookingRules,
    query,
    fields,
    orderBy,
    options,
  );
}
