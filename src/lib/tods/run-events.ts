import type { RunEvent } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { runEvents } from '../../schema/tables/tods/run-events.ts';
import { findRows } from '../find-rows.ts';

export function getRunEvents<Fields extends keyof RunEvent>(
  query: RowQuery<RunEvent> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RunEvent> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RunEvent, Fields>(runEvents, query, fields, orderBy, options);
}
