import type {
  TimetableStopOrder,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { timetableStopOrder } from '../../models/non-standard/timetable-stop-order.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all timetable stop orders that match the query parameters.
 */
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
