import type { FareTransferRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareTransferRules } from '../../schema/tables/gtfs-schedule/fare-transfer-rules.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare transfer rules that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
