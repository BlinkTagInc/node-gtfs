import type { StopArea } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopAreas } from '../../schema/tables/gtfs-schedule/stop-areas.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop areas that match the query parameters.
 */
export function getStopAreas<Fields extends keyof StopArea>(
  query: RowQuery<StopArea> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopArea> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopArea, Fields>(stopAreas, query, fields, orderBy, options);
}
