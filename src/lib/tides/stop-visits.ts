import type { StopVisit } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopVisits } from '../../schema/tables/tides/stop-visits.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all stop visits that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getStopVisits<Fields extends keyof StopVisit>(
  query: RowQuery<StopVisit> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopVisit> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopVisit, Fields>(
    stopVisits,
    query,
    fields,
    orderBy,
    options,
  );
}
