import type { TrainCar } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { trainCars } from '../../schema/tables/tides/train-cars.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all train cars that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTrainCars<Fields extends keyof TrainCar>(
  query: RowQuery<TrainCar> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TrainCar> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TrainCar, Fields>(trainCars, query, fields, orderBy, options);
}
