import type {
  TimetableNotesReference,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableNotesReferences } from '../../models/non-standard/timetable-notes-references.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timetable notes references that match the query parameters.
 */
export function getTimetableNotesReferences<
  Fields extends keyof TimetableNotesReference,
>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TimetableNotesReference, Fields>(
    timetableNotesReferences,
    query,
    fields,
    orderBy,
    options,
  );
}
