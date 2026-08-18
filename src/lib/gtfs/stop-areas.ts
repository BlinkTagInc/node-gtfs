import type { StopArea } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopAreas } from '../../schema/tables/gtfs-schedule/stop-areas.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all stop areas that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getStopAreas<Fields extends keyof StopArea>(
  query: RowQuery<StopArea> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopArea> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopArea, Fields>(stopAreas, query, fields, orderBy, options);
}
