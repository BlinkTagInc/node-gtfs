import type {
  RideFeedInfo,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { rideFeedInfo } from '../../schema/tables/gtfs-ride/ride-feed-info.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all ride-feed-info that match the query parameters.
 */
export function getRideFeedInfo<Fields extends keyof RideFeedInfo>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RideFeedInfo, Fields>(
    rideFeedInfo,
    query,
    fields,
    orderBy,
    options,
  );
}
