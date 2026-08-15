import type {
  FareProduct,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareProducts } from '../../models/gtfs/fare-products.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare products that match the query parameters.
 */
export function getFareProducts<Fields extends keyof FareProduct>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareProduct, Fields>(
    fareProducts,
    query,
    fields,
    orderBy,
    options,
  );
}
