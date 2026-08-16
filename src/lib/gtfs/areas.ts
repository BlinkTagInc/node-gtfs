import type {
  Area,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { areas } from '../../schema/tables/gtfs-schedule/areas.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all areas that match the query parameters.
 */
export function getAreas<Fields extends keyof Area>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Area, Fields>(areas, query, fields, orderBy, options);
}
