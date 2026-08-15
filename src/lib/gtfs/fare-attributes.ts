import type {
  FareAttribute,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareAttributes } from '../../models/gtfs/fare-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare attributes that match the query parameters.
 */
export function getFareAttributes<Fields extends keyof FareAttribute>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareAttribute, Fields>(
    fareAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
