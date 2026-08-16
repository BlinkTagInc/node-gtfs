import type {
  Frequency,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { frequencies } from '../../schema/tables/gtfs-schedule/frequencies.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all frequencies that match the query parameters.
 */
export function getFrequencies<Fields extends keyof Frequency>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Frequency, Fields>(
    frequencies,
    query,
    fields,
    orderBy,
    options,
  );
}
