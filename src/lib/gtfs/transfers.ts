import type { Transfer } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { transfers } from '../../schema/tables/gtfs-schedule/transfers.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all transfers that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTransfers<Fields extends keyof Transfer>(
  query: RowQuery<Transfer> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Transfer> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Transfer, Fields>(transfers, query, fields, orderBy, options);
}
