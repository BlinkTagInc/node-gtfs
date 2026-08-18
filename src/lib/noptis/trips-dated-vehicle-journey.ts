import type { TripsDatedVehicleJourney } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripsDatedVehicleJourney } from '../../schema/tables/noptis/trips-dated-vehicle-journey.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all dated vehicle journeys that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTripsDatedVehicleJourneys<
  Fields extends keyof TripsDatedVehicleJourney,
>(
  query: RowQuery<TripsDatedVehicleJourney> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TripsDatedVehicleJourney> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TripsDatedVehicleJourney, Fields>(
    tripsDatedVehicleJourney,
    query,
    fields,
    orderBy,
    options,
  );
}
