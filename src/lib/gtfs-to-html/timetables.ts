import type {
  Timetable,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetables } from '../../schema/tables/gtfs-to-html/timetables.ts';
import { findRows } from '../find-rows.ts';

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
