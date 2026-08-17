import type { FareLegJoinRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareLegJoinRules } from '../../schema/tables/gtfs-schedule/fare-leg-join-rules.ts';
import { findRows } from '../find-rows.ts';

export function getFareLegJoinRules<Fields extends keyof FareLegJoinRule>(
  query: RowQuery<FareLegJoinRule> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareLegJoinRule> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareLegJoinRule, Fields>(
    fareLegJoinRules,
    query,
    fields,
    orderBy,
    options,
  );
}
