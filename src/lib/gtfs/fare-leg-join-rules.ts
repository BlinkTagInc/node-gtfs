import type {
  FareLegJoinRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareLegJoinRules } from '../../schema/tables/gtfs-schedule/fare-leg-join-rules.ts';
import { findRows } from '../find-rows.ts';

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
