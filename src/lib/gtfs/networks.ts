import type {
  Network,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { networks } from '../../models/gtfs/networks.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all networks that match the query parameters.
 */
export function getNetworks<Fields extends keyof Network>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Network, Fields>(networks, query, fields, orderBy, options);
}
