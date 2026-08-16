import type {
  Ridership,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { ridership } from '../../schema/tables/gtfs-ride/ridership.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all ridership that match the query parameters.
 */
export function getRidership<Fields extends keyof Ridership>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Ridership, Fields>(
    ridership,
    query,
    fields,
    orderBy,
    options,
  );
}
