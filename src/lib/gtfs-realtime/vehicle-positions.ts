import type {
  VehiclePosition,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { vehiclePositions } from '../../models/gtfs-realtime/vehicle-positions.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all vehicle positions that match the query parameters.
 */
export function getVehiclePositions<Fields extends keyof VehiclePosition>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<VehiclePosition, Fields>(
    vehiclePositions,
    query,
    fields,
    orderBy,
    options,
  );
}
