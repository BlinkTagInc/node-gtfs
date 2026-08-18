import type { PassengerEvent } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { passengerEvents } from '../../schema/tables/tides/passenger-events.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all passenger events that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
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
