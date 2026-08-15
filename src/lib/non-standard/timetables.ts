import type {
  Timetable,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetables } from '../../models/non-standard/timetables.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timetables that match the query parameters.
 */
export function getTimetables<Fields extends keyof Timetable>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Timetable, Fields>(
    timetables,
    query,
    fields,
    orderBy,
    options,
  );
}
