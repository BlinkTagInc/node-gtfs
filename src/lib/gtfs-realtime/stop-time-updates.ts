import type {
  StopTimeUpdate,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { stopTimeUpdates } from '../../schema/tables/gtfs-realtime/stop-time-updates.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop time updates that match the query parameters.
 */
export function getStopTimeUpdates<Fields extends keyof StopTimeUpdate>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<StopTimeUpdate, Fields>(
    stopTimeUpdates,
    query,
    fields,
    orderBy,
    options,
  );
}
