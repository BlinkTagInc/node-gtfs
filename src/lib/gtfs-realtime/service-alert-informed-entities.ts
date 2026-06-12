import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  ServiceAlertInformedEntity,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all service alert informed entities that match the query parameters.
 */
export function getServiceAlertInformedEntities<
  Fields extends keyof ServiceAlertInformedEntity,
>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'service_alert_informed_entities';
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<ServiceAlertInformedEntity, Fields>[];
}
