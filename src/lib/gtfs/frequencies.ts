import type { Frequency } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { frequencies } from '../../schema/tables/gtfs-schedule/frequencies.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all frequencies that match the query parameters.
 */
export function getFrequencies<Fields extends keyof Frequency>(
  query: RowQuery<Frequency> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Frequency> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Frequency, Fields>(
    frequencies,
    query,
    fields,
    orderBy,
    options,
  );
}
