import type { TimetableNote } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableNotes } from '../../schema/tables/gtfs-to-html/timetable-notes.ts';
import { findRows } from '../find-rows.ts';

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
