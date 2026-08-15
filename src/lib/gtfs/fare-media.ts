import type {
  FareMedia,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { fareMedia } from '../../models/gtfs/fare-media.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare media that match the query parameters.
 */
export function getFareMedia<Fields extends keyof FareMedia>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<FareMedia, Fields>(
    fareMedia,
    query,
    fields,
    orderBy,
    options,
  );
}
