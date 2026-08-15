import type {
  TimetableNote,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableNotes } from '../../models/non-standard/timetable-notes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timetable notes that match the query parameters.
 */
export function getTimetableNotes<Fields extends keyof TimetableNote>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TimetableNote, Fields>(
    timetableNotes,
    query,
    fields,
    orderBy,
    options,
  );
}
