import type { Timeframe } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timeframes } from '../../schema/tables/gtfs-schedule/timeframes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timeframes that match the query parameters.
 */
export function getTimeframes<Fields extends keyof Timeframe>(
  query: RowQuery<Timeframe> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Timeframe> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Timeframe, Fields>(
    timeframes,
    query,
    fields,
    orderBy,
    options,
  );
}
