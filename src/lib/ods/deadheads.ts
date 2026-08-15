import type {
  Deadhead,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { deadheads } from '../../models/ods/deadheads.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all deadheads that match the query parameters.
 */
export function getDeadheads<Fields extends keyof Deadhead>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Deadhead, Fields>(deadheads, query, fields, orderBy, options);
}
