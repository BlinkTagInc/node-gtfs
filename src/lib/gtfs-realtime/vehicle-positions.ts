import type { VehiclePosition } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { vehiclePositions } from '../../schema/tables/gtfs-realtime/vehicle-positions.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all vehicle positions that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
