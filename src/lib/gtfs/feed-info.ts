import type {
  FeedInfo,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { feedInfo } from '../../schema/tables/gtfs-schedule/feed-info.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all feed info that match the query parameters.
 */
export function getFeedInfo<Fields extends keyof FeedInfo>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FeedInfo, Fields>(feedInfo, query, fields, orderBy, options);
}
