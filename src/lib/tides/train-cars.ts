import type { TrainCar } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { trainCars } from '../../schema/tables/tides/train-cars.ts';
import { findRows } from '../find-rows.ts';

export function getTrainCars<Fields extends keyof TrainCar>(
  query: RowQuery<TrainCar> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TrainCar> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TrainCar, Fields>(trainCars, query, fields, orderBy, options);
}
