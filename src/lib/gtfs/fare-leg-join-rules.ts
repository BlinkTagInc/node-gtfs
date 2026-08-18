import type { FareLegJoinRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareLegJoinRules } from '../../schema/tables/gtfs-schedule/fare-leg-join-rules.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare leg join rules that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
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
