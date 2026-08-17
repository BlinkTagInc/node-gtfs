import type { Attribution } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { attributions } from '../../schema/tables/gtfs-schedule/attributions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all attributions that match the query parameters.
 */
export function getAttributions<Fields extends keyof Attribution>(
  query: RowQuery<Attribution> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Attribution> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Attribution, Fields>(
    attributions,
    query,
    fields,
    orderBy,
    options,
  );
}
