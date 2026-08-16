import type {
  Attribution,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { attributions } from '../../schema/tables/gtfs-schedule/attributions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all attributions that match the query parameters.
 */
export function getAttributions<Fields extends keyof Attribution>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Attribution, Fields>(
    attributions,
    query,
    fields,
    orderBy,
    options,
  );
}
