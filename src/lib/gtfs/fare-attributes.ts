import type { FareAttribute } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareAttributes } from '../../schema/tables/gtfs-schedule/fare-attributes.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare attributes that match the query parameters.
 */
export function getFareAttributes<Fields extends keyof FareAttribute>(
  query: RowQuery<FareAttribute> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareAttribute> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareAttribute, Fields>(
    fareAttributes,
    query,
    fields,
    orderBy,
    options,
  );
}
