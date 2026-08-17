import type { RiderCategory } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { riderCategories } from '../../schema/tables/gtfs-schedule/rider-categories.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all rider categories that match the query parameters.
 */
export function getRiderCategories<Fields extends keyof RiderCategory>(
  query: RowQuery<RiderCategory> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RiderCategory> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RiderCategory, Fields>(
    riderCategories,
    query,
    fields,
    orderBy,
    options,
  );
}
