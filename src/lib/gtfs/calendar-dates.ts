import type {
  CalendarDate,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { calendarDates } from '../../models/gtfs/calendar-dates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of calendarDates that match the query parameters.
 */
export function getCalendarDates<Fields extends keyof CalendarDate>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<CalendarDate, Fields>(
    calendarDates,
    query,
    fields,
    orderBy,
    options,
  );
}
