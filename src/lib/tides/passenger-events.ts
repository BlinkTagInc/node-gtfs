import type { PassengerEvent } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { passengerEvents } from '../../schema/tables/tides/passenger-events.ts';
import { findRows } from '../find-rows.ts';

export function getPassengerEvents<Fields extends keyof PassengerEvent>(
  query: RowQuery<PassengerEvent> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<PassengerEvent> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<PassengerEvent, Fields>(
    passengerEvents,
    query,
    fields,
    orderBy,
    options,
  );
}
