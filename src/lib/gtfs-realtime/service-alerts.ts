import type {
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
  ServiceAlert,
  ServiceAlertInformedEntity,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.ts';

/*
 * Returns an array of all service alerts that match the query parameters.
 * Each alert includes a nested `informed_entities` array containing all of
 * its related informed entities.
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

  const alerts = db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as Omit<ServiceAlert, 'informed_entities'>[];

  const alertIds = alerts.map((alert) => alert.id);
  if (alertIds.length === 0) {
    return [];
  }

  const placeholders = alertIds.map(() => '?').join(', ');
  const entities = db
    .prepare(
      `SELECT * FROM ${joinTableName} WHERE alert_id IN (${placeholders});`,
    )
    .all(...alertIds) as ServiceAlertInformedEntity[];

  const entitiesByAlertId = new Map<string, ServiceAlertInformedEntity[]>();
  for (const entity of entities) {
    const group = entitiesByAlertId.get(entity.alert_id);
    if (group) {
      group.push(entity);
    } else {
      entitiesByAlertId.set(entity.alert_id, [entity]);
    }
  }

  return alerts.map((alert) => ({
    ...alert,
    informed_entities: entitiesByAlertId.get(alert.id) ?? [],
  }));
}
