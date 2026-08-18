import type { Area } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { areas } from '../../schema/tables/gtfs-schedule/areas.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all areas that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getAreas<Fields extends keyof Area>(
  query: RowQuery<Area> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Area> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Area, Fields>(areas, query, fields, orderBy, options);
}
