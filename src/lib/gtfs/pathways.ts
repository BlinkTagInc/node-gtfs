import type { Pathway } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { pathways } from '../../schema/tables/gtfs-schedule/pathways.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all pathways that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getPathways<Fields extends keyof Pathway>(
  query: RowQuery<Pathway> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Pathway> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Pathway, Fields>(pathways, query, fields, orderBy, options);
}
