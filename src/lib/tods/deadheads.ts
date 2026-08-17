import type { Deadhead } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { deadheads } from '../../schema/tables/tods/deadheads.ts';
import { findRows } from '../find-rows.ts';

export function getDeadheads<Fields extends keyof Deadhead>(
  query: RowQuery<Deadhead> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Deadhead> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Deadhead, Fields>(deadheads, query, fields, orderBy, options);
}
