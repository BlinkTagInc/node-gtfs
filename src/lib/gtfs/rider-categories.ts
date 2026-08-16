import type {
  RiderCategory,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { riderCategories } from '../../schema/tables/gtfs-schedule/rider-categories.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all rider categories that match the query parameters.
 */
export function getRiderCategories<Fields extends keyof RiderCategory>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RiderCategory, Fields>(
    riderCategories,
    query,
    fields,
    orderBy,
    options,
  );
}
