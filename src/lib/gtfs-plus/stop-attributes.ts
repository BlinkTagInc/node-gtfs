import type { StopAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopAttributes } from '../../schema/tables/gtfs-plus/stop-attributes.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all stop attributes that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
