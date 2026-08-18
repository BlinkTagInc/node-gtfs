import type { Frequency } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { frequencies } from '../../schema/tables/gtfs-schedule/frequencies.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all frequencies that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
