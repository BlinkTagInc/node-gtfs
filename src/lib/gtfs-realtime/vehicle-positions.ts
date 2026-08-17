import type { VehiclePosition } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehiclePositions } from '../../schema/tables/gtfs-realtime/vehicle-positions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all vehicle positions that match the query parameters.
 */
export function getVehiclePositions<Fields extends keyof VehiclePosition>(
  query: RowQuery<VehiclePosition> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<VehiclePosition> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<VehiclePosition, Fields>(
    vehiclePositions,
    query,
    fields,
    orderBy,
    options,
  );
}
