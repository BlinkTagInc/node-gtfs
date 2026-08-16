import type {
  Direction,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { directions } from '../../schema/tables/gtfs-plus/directions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all directions that match the query parameters.
 */
export function getDirections<Fields extends keyof Direction>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Direction, Fields>(
    directions,
    query,
    fields,
    orderBy,
    options,
  );
}
