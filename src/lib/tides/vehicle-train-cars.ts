import type { VehicleTrainCar } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehicleTrainCars } from '../../schema/tables/tides/vehicle-train-cars.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all vehicle train cars that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getVehicleTrainCars<Fields extends keyof VehicleTrainCar>(
  query: RowQuery<VehicleTrainCar> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<VehicleTrainCar> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<VehicleTrainCar, Fields>(
    vehicleTrainCars,
    query,
    fields,
    orderBy,
    options,
  );
}
