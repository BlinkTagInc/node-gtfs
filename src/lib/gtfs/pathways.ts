import type {
  Pathway,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { pathways } from '../../schema/tables/gtfs-schedule/pathways.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all pathways that match the query parameters.
 */
export function getPathways<Fields extends keyof Pathway>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Pathway, Fields>(pathways, query, fields, orderBy, options);
}
