import type { Area } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { areas } from '../../schema/tables/gtfs-schedule/areas.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all areas that match the query parameters.
 */
export function getAreas<Fields extends keyof Area>(
  query: RowQuery<Area> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Area> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Area, Fields>(areas, query, fields, orderBy, options);
}
