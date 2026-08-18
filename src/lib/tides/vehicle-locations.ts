import type { VehicleLocation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehicleLocations } from '../../schema/tables/tides/vehicle-locations.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all vehicle locations that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
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
