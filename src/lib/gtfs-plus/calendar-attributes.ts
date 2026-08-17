import type { CalendarAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { calendarAttributes } from '../../schema/tables/gtfs-plus/calendar-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all calendar_attributes that match the query parameters.
 */
export function getCalendarAttributes<Fields extends keyof CalendarAttribute>(
  query: RowQuery<CalendarAttribute> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<CalendarAttribute> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<CalendarAttribute, Fields>(
    calendarAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
