import type { Transfer } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { transfers } from '../../schema/tables/gtfs-schedule/transfers.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all transfers that match the query parameters.
 */
export function getTransfers<Fields extends keyof Transfer>(
  query: RowQuery<Transfer> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Transfer> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Transfer, Fields>(transfers, query, fields, orderBy, options);
}
