import type { Pathway } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { pathways } from '../../schema/tables/gtfs-schedule/pathways.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all pathways that match the query parameters.
 */
export function getPathways<Fields extends keyof Pathway>(
  query: RowQuery<Pathway> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Pathway> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Pathway, Fields>(pathways, query, fields, orderBy, options);
}
