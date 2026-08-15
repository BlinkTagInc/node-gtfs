import type {
  FareLegJoinRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareLegJoinRules } from '../../models/gtfs/fare-leg-join-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare leg join rules that match the query parameters.
 */
export function getFareLegJoinRules<Fields extends keyof FareLegJoinRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareLegJoinRule, Fields>(
    fareLegJoinRules,
    query,
    fields,
    orderBy,
    options,
  );
}
