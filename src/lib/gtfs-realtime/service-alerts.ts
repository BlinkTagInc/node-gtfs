import sqlString from 'sqlstring-sqlite';

import {
  QueryOptions,
  SqlOrderBy,
  SqlResults,
  SqlSelect,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';
import serviceAlerts from '../../models/gtfs-realtime/service-alerts.ts';
import serviceAlertTargets from '../../models/gtfs-realtime/service-alert-targets.ts';

/*
 * Returns an array of all service alerts that match the query parameters.
 */
export function getServiceAlerts(
  query: SqlWhere = {},
  fields: SqlSelect = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
): SqlResults {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(serviceAlerts.filenameBase);
  const joinTable = sqlString.escapeId(serviceAlertTargets.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} INNER JOIN ${joinTable} ON ${tableName}.id=${joinTable}.alert_id ${whereClause} ${orderByClause};`,
    )
    .all() as SqlResults;
}
