import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  VehiclePosition,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all vehicle positions that match the query parameters.
 */
export function getVehiclePositions<Fields extends keyof VehiclePosition>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'vehicle_positions';
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<VehiclePosition, Fields>[];
}
