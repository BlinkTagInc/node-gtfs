import type { FareLegRule } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareLegRules } from '../../schema/tables/gtfs-schedule/fare-leg-rules.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare leg rules that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
