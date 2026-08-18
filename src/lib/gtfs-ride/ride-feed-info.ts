import type { RideFeedInfo } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { rideFeedInfo } from '../../schema/tables/gtfs-ride/ride-feed-info.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all ride-feed-info that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRideFeedInfo<Fields extends keyof RideFeedInfo>(
  query: RowQuery<RideFeedInfo> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RideFeedInfo> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RideFeedInfo, Fields>(
    rideFeedInfo,
    query,
    fields,
    orderBy,
    options,
  );
}
