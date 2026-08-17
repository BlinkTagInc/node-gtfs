import type { TimetableStopOrder } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { timetableStopOrder } from '../../schema/tables/gtfs-to-html/timetable-stop-order.ts';
import { findRows } from '../find-rows.ts';

export function getTimetableStopOrders<Fields extends keyof TimetableStopOrder>(
  query: RowQuery<TimetableStopOrder> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TimetableStopOrder> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TimetableStopOrder, Fields>(
    timetableStopOrder,
    query,
    fields,
    orderBy,
    options,
  );
}
