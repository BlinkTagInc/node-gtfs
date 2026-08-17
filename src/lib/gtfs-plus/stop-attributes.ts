import type { StopAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopAttributes } from '../../schema/tables/gtfs-plus/stop-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all stop attributes that match the query parameters.
 */
export function getStopAttributes<Fields extends keyof StopAttribute>(
  query: RowQuery<StopAttribute> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopAttribute> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopAttribute, Fields>(
    stopAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
