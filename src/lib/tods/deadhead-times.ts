import type {
  DeadheadTime,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { deadheadTimes } from '../../schema/tables/tods/deadhead-times.ts';
import { findRows } from '../find-rows.ts';

export function getDeadheadTimes<Fields extends keyof DeadheadTime>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<DeadheadTime, Fields>(
    deadheadTimes,
    query,
    fields,
    orderBy,
    options,
  );
}
