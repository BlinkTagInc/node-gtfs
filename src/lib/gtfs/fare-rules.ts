import type { FareRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareRules } from '../../schema/tables/gtfs-schedule/fare-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare rules that match the query parameters.
 */
export function getFareRules<Fields extends keyof FareRule>(
  query: RowQuery<FareRule> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareRule> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareRule, Fields>(fareRules, query, fields, orderBy, options);
}
