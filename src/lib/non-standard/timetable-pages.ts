import type {
  TimetablePage,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetablePages } from '../../models/non-standard/timetable-pages.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timetable pages that match the query parameters.
 */
export function getTimetablePages<Fields extends keyof TimetablePage>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TimetablePage, Fields>(
    timetablePages,
    query,
    fields,
    orderBy,
    options,
  );
}
