import type { CalendarDate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { calendarDates } from '../../schema/tables/gtfs-schedule/calendar-dates.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of calendarDates that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getCalendarDates<Fields extends keyof CalendarDate>(
  query: RowQuery<CalendarDate> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<CalendarDate> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<CalendarDate, Fields>(
    calendarDates,
    query,
    fields,
    orderBy,
    options,
  );
}
