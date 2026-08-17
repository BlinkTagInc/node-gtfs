import type { StopTimeUpdate } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopTimeUpdates } from '../../schema/tables/gtfs-realtime/stop-time-updates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop time updates that match the query parameters.
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
