import type {
  TimetableNote,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableNotes } from '../../schema/tables/gtfs-to-html/timetable-notes.ts';
import { findRows } from '../find-rows.ts';

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
