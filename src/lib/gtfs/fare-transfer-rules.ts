import type { FareTransferRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareTransferRules } from '../../schema/tables/gtfs-schedule/fare-transfer-rules.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare transfer rules that match the query parameters.
 */
export function getFareTransferRules<Fields extends keyof FareTransferRule>(
  query: RowQuery<FareTransferRule> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareTransferRule> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareTransferRule, Fields>(
    fareTransferRules,
    query,
    fields,
    orderBy,
    options,
  );
}
