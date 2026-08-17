import type { Ridership } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { ridership } from '../../schema/tables/gtfs-ride/ridership.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all ridership that match the query parameters.
 */
export function getRidership<Fields extends keyof Ridership>(
  query: RowQuery<Ridership> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Ridership> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Ridership, Fields>(
    ridership,
    query,
    fields,
    orderBy,
    options,
  );
}
