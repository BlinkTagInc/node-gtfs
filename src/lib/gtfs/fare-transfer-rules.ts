import type {
  FareTransferRule,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareTransferRules } from '../../schema/tables/gtfs-schedule/fare-transfer-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare transfer rules that match the query parameters.
 */
export function getFareTransferRules<Fields extends keyof FareTransferRule>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareTransferRule, Fields>(
    fareTransferRules,
    query,
    fields,
    orderBy,
    options,
  );
}
