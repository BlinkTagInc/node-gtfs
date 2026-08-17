import type { DeadheadTime } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { deadheadTimes } from '../../schema/tables/tods/deadhead-times.ts';
import { findRows } from '../find-rows.ts';

export function getDeadheadTimes<Fields extends keyof DeadheadTime>(
  query: RowQuery<DeadheadTime> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<DeadheadTime> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<DeadheadTime, Fields>(
    deadheadTimes,
    query,
    fields,
    orderBy,
    options,
  );
}
