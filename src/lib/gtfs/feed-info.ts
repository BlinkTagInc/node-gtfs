import type { FeedInfo } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { feedInfo } from '../../schema/tables/gtfs-schedule/feed-info.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all feed info that match the query parameters.
 */
export function getFeedInfo<Fields extends keyof FeedInfo>(
  query: RowQuery<FeedInfo> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FeedInfo> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FeedInfo, Fields>(feedInfo, query, fields, orderBy, options);
}
