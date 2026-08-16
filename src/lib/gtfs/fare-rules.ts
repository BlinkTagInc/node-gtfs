import type {
  FareRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareRules } from '../../schema/tables/gtfs-schedule/fare-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare rules that match the query parameters.
 */
export function getFareRules<Fields extends keyof FareRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareRule, Fields>(fareRules, query, fields, orderBy, options);
}
