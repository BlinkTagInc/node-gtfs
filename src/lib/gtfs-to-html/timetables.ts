import type { Timetable } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetables } from '../../schema/tables/gtfs-to-html/timetables.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all timetables that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
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
