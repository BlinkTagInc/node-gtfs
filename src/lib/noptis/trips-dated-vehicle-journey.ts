import type {
  TripsDatedVehicleJourney,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { tripsDatedVehicleJourney } from '../../schema/tables/noptis/trips-dated-vehicle-journey.ts';
import { findRows } from '../find-rows.ts';

export function getTripsDatedVehicleJourneys<
  Fields extends keyof TripsDatedVehicleJourney,
>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<TripsDatedVehicleJourney, Fields>(
    tripsDatedVehicleJourney,
    query,
    fields,
    orderBy,
    options,
  );
}
