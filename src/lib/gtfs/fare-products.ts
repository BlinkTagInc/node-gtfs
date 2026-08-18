import type { FareProduct } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareProducts } from '../../schema/tables/gtfs-schedule/fare-products.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all fare products that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getFareProducts<Fields extends keyof FareProduct>(
  query: RowQuery<FareProduct> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareProduct> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareProduct, Fields>(
    fareProducts,
    query,
    fields,
    orderBy,
    options,
  );
}
