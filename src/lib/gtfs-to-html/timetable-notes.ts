import type { TimetableNote } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableNotes } from '../../schema/tables/gtfs-to-html/timetable-notes.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all timetable notes that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTimetableNotes<Fields extends keyof TimetableNote>(
  query: RowQuery<TimetableNote> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TimetableNote> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TimetableNote, Fields>(
    timetableNotes,
    query,
    fields,
    orderBy,
    options,
  );
}
