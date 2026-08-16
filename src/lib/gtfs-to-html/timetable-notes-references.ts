import type {
  TimetableNotesReference,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableNotesReferences } from '../../schema/tables/gtfs-to-html/timetable-notes-references.ts';
import { findRows } from '../find-rows.ts';

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
