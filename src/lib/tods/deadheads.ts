import type {
  Deadhead,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { deadheads } from '../../schema/tables/tods/deadheads.ts';
import { findRows } from '../find-rows.ts';

export function getDeadheads<Fields extends keyof Deadhead>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Deadhead, Fields>(deadheads, query, fields, orderBy, options);
}
