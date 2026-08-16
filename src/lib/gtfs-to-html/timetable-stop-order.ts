import type {
  TimetableStopOrder,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableStopOrder } from '../../schema/tables/gtfs-to-html/timetable-stop-order.ts';
import { findRows } from '../find-rows.ts';

export function getTimetableStopOrders<Fields extends keyof TimetableStopOrder>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TimetableStopOrder, Fields>(
    timetableStopOrder,
    query,
    fields,
    orderBy,
    options,
  );
}
