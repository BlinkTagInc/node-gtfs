import type { FareTransaction } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareTransactions } from '../../schema/tables/tides/fare-transactions.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare transactions that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getFareTransactions<Fields extends keyof FareTransaction>(
  query: RowQuery<FareTransaction> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareTransaction> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareTransaction, Fields>(
    fareTransactions,
    query,
    fields,
    orderBy,
    options,
  );
}
