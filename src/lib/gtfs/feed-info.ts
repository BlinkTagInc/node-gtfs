import type { FeedInfo } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { feedInfo } from '../../schema/tables/gtfs-schedule/feed-info.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all feed info that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getFeedInfo<Fields extends keyof FeedInfo>(
  query: RowQuery<FeedInfo> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FeedInfo> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FeedInfo, Fields>(feedInfo, query, fields, orderBy, options);
}
