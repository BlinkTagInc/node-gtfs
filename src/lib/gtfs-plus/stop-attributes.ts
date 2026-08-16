import type {
  StopAttribute,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { stopAttributes } from '../../schema/tables/gtfs-plus/stop-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop attributes that match the query parameters.
 */
export function getStopAttributes<Fields extends keyof StopAttribute>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<StopAttribute, Fields>(
    stopAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
