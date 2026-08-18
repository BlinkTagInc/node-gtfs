import type { StopTimeUpdate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopTimeUpdates } from '../../schema/tables/gtfs-realtime/stop-time-updates.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all stop time updates that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getStopTimeUpdates<Fields extends keyof StopTimeUpdate>(
  query: RowQuery<StopTimeUpdate> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopTimeUpdate> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopTimeUpdate, Fields>(
    stopTimeUpdates,
    query,
    fields,
    orderBy,
    options,
  );
}
