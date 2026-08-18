import type { Vehicle } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehicles } from '../../schema/tables/tides/vehicles.ts';
import { findRows } from '../find-rows.ts';

export function getVehicles<Fields extends keyof Vehicle>(
  query: RowQuery<Vehicle> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Vehicle> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Vehicle, Fields>(vehicles, query, fields, orderBy, options);
}
