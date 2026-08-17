import type { Network } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { networks } from '../../schema/tables/gtfs-schedule/networks.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all networks that match the query parameters.
 */
export function getNetworks<Fields extends keyof Network>(
  query: RowQuery<Network> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Network> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Network, Fields>(networks, query, fields, orderBy, options);
}
