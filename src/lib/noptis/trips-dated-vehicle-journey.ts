import type { TripsDatedVehicleJourney } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripsDatedVehicleJourney } from '../../schema/tables/noptis/trips-dated-vehicle-journey.ts';
import { findRows } from '../find-rows.ts';

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
