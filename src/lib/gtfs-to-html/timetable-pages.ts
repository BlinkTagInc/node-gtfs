import type { TimetablePage } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetablePages } from '../../schema/tables/gtfs-to-html/timetable-pages.ts';
import { findRows } from '../find-rows.ts';

export function getTimetablePages<Fields extends keyof TimetablePage>(
  query: RowQuery<TimetablePage> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TimetablePage> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TimetablePage, Fields>(
    timetablePages,
    query,
    fields,
    orderBy,
    options,
  );
}
