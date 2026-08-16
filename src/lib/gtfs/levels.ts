import type {
  Level,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { levels } from '../../schema/tables/gtfs-schedule/levels.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all levels that match the query parameters.
 */
export function getLevels<Fields extends keyof Level>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Level, Fields>(levels, query, fields, orderBy, options);
}
