import type { CalendarDate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { calendarDates } from '../../schema/tables/gtfs-schedule/calendar-dates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of calendarDates that match the query parameters.
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
