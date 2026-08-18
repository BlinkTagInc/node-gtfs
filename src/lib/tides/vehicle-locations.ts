import type { VehicleLocation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehicleLocations } from '../../schema/tables/tides/vehicle-locations.ts';
import { findRows } from '../find-rows.ts';

export function getVehicleLocations<Fields extends keyof VehicleLocation>(
  query: RowQuery<VehicleLocation> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<VehicleLocation> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<VehicleLocation, Fields>(
    vehicleLocations,
    query,
    fields,
    orderBy,
    options,
  );
}
