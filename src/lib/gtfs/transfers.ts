import type {
  Transfer,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { transfers } from '../../schema/tables/gtfs-schedule/transfers.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all transfers that match the query parameters.
 */
export function getTransfers<Fields extends keyof Transfer>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Transfer, Fields>(transfers, query, fields, orderBy, options);
}
