import type { FareMedia } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareMedia } from '../../schema/tables/gtfs-schedule/fare-media.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare media that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getFareMedia<Fields extends keyof FareMedia>(
  query: RowQuery<FareMedia> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareMedia> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareMedia, Fields>(
    fareMedia,
    query,
    fields,
    orderBy,
    options,
  );
}
