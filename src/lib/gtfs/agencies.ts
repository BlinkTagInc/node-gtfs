import type { Agency } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { agency } from '../../schema/tables/gtfs-schedule/agency.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all agencies that match the query parameters.
 */
export function getAgencies<Fields extends keyof Agency>(
  query: RowQuery<Agency> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Agency> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Agency, Fields>(agency, query, fields, orderBy, options);
}
