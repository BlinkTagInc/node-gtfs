import type { FareLegRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareLegRules } from '../../schema/tables/gtfs-schedule/fare-leg-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare leg rules that match the query parameters.
 */
export function getFareLegRules<Fields extends keyof FareLegRule>(
  query: RowQuery<FareLegRule> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareLegRule> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareLegRule, Fields>(
    fareLegRules,
    query,
    fields,
    orderBy,
    options,
  );
}
