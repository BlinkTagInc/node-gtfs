import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  ServiceAlert,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all service alerts that match the query parameters.
 */
export function getServiceAlerts<Fields extends keyof ServiceAlert>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'service_alerts';
  const joinTableName = 'service_alert_informed_entities';
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} INNER JOIN ${joinTableName} ON ${tableName}.id=${joinTableName}.alert_id ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<ServiceAlert, Fields>[];
}
