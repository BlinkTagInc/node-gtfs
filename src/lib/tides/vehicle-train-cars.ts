import type { VehicleTrainCar } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehicleTrainCars } from '../../schema/tables/tides/vehicle-train-cars.ts';
import { findRows } from '../find-rows.ts';

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
