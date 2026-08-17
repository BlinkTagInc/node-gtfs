import type { Level } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { levels } from '../../schema/tables/gtfs-schedule/levels.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all levels that match the query parameters.
 */
export function getLevels<Fields extends keyof Level>(
  query: RowQuery<Level> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Level> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Level, Fields>(levels, query, fields, orderBy, options);
}
