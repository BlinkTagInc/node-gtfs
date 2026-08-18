import type { OpsLocation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { opsLocations } from '../../schema/tables/tods/ops-locations.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all ops locations that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getOpsLocations<Fields extends keyof OpsLocation>(
  query: RowQuery<OpsLocation> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<OpsLocation> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<OpsLocation, Fields>(
    opsLocations,
    query,
    fields,
    orderBy,
    options,
  );
}
