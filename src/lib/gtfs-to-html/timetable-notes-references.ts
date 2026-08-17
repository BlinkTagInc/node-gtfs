import type { TimetableNotesReference } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableNotesReferences } from '../../schema/tables/gtfs-to-html/timetable-notes-references.ts';
import { findRows } from '../find-rows.ts';

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
