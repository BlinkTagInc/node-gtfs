import type {
  Agency,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { agency } from '../../models/gtfs/agency.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export function getAgencies<Fields extends keyof Agency>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Agency, Fields>(agency, query, fields, orderBy, options);
}
