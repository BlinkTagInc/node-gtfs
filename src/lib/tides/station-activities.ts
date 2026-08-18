import type { StationActivity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stationActivities } from '../../schema/tables/tides/station-activities.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all station activities that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getStationActivities<Fields extends keyof StationActivity>(
  query: RowQuery<StationActivity> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StationActivity> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StationActivity, Fields>(
    stationActivities,
    query,
    fields,
    orderBy,
    options,
  );
}
