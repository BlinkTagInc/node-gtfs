import type {
  TimetablePage,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetablePages } from '../../schema/tables/gtfs-to-html/timetable-pages.ts';
import { findRows } from '../find-rows.ts';

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
