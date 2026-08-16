import type {
  CalendarAttribute,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { calendarAttributes } from '../../schema/tables/gtfs-plus/calendar-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all calendar_attributes that match the query parameters.
 */
export function getCalendarAttributes<Fields extends keyof CalendarAttribute>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<CalendarAttribute, Fields>(
    calendarAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
