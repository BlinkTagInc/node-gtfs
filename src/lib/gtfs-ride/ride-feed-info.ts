import type { RideFeedInfo } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { rideFeedInfo } from '../../schema/tables/gtfs-ride/ride-feed-info.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all ride-feed-info that match the query parameters.
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
