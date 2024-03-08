import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import serviceAlerts from '../../models/gtfs-realtime/service-alerts.js';
import serviceAlertTargets from '../../models/gtfs-realtime/service-alert-targets.js';

/*
 * Returns an array of all service alerts that match the query parameters.
 */
export function getServiceAlerts(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(serviceAlerts.filenameBase);
  const joinTable = sqlString.escapeId(serviceAlertTargets.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} INNER JOIN ${joinTable} ON ${tableName}.id=${joinTable}.alert_id ${whereClause} ${orderByClause};`
    )
    .all();
}
