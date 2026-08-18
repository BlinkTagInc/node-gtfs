import type { TimetableNotesReference } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableNotesReferences } from '../../schema/tables/gtfs-to-html/timetable-notes-references.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all timetable note references that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTimetableNotesReferences<
  Fields extends keyof TimetableNotesReference,
>(
  query: RowQuery<TimetableNotesReference> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TimetableNotesReference> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TimetableNotesReference, Fields>(
    timetableNotesReferences,
    query,
    fields,
    orderBy,
    options,
  );
}
