import type { Timetable } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetables } from '../../schema/tables/gtfs-to-html/timetables.ts';
import { findRows } from '../find-rows.ts';

export function getTimetables<Fields extends keyof Timetable>(
  query: RowQuery<Timetable> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Timetable> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Timetable, Fields>(
    timetables,
    query,
    fields,
    orderBy,
    options,
  );
}
