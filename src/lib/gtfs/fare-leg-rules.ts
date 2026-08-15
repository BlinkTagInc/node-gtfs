import type {
  FareLegRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareLegRules } from '../../models/gtfs/fare-leg-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare leg rules that match the query parameters.
 */
export function getFareLegRules<Fields extends keyof FareLegRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareLegRule, Fields>(
    fareLegRules,
    query,
    fields,
    orderBy,
    options,
  );
}
