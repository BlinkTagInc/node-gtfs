import type { FareTransaction } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareTransactions } from '../../schema/tables/tides/fare-transactions.ts';
import { findRows } from '../find-rows.ts';

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
