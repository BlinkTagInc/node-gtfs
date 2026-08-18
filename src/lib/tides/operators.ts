import type { Operator } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { operators } from '../../schema/tables/tides/operators.ts';
import { findRows } from '../find-rows.ts';

export function getOperators<Fields extends keyof Operator>(
  query: RowQuery<Operator> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Operator> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Operator, Fields>(operators, query, fields, orderBy, options);
}
