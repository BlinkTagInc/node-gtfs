import type {
  StopArea,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { stopAreas } from '../../schema/tables/gtfs-schedule/stop-areas.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop areas that match the query parameters.
 */
export function getStopAreas<Fields extends keyof StopArea>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<StopArea, Fields>(stopAreas, query, fields, orderBy, options);
}
