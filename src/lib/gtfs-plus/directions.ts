import type { Direction } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { directions } from '../../schema/tables/gtfs-plus/directions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all directions that match the query parameters.
 */
export function getDirections<Fields extends keyof Direction>(
  query: RowQuery<Direction> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Direction> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Direction, Fields>(
    directions,
    query,
    fields,
    orderBy,
    options,
  );
}
