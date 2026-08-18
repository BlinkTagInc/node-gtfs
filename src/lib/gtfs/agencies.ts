import type { Agency } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { agency } from '../../schema/tables/gtfs-schedule/agency.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all agencies that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getAgencies<Fields extends keyof Agency>(
  query: RowQuery<Agency> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Agency> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Agency, Fields>(agency, query, fields, orderBy, options);
}
