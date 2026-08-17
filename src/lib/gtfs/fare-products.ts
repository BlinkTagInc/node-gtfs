import type { FareProduct } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareProducts } from '../../schema/tables/gtfs-schedule/fare-products.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare products that match the query parameters.
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
