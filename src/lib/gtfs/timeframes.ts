import type {
  Timeframe,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timeframes } from '../../models/gtfs/timeframes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timeframes that match the query parameters.
 */
export function getTimeframes<Fields extends keyof Timeframe>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Timeframe, Fields>(
    timeframes,
    query,
    fields,
    orderBy,
    options,
  );
}
