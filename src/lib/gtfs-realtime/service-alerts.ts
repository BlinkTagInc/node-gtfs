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

// Columns that live in service_alert_informed_entities, not service_alerts.
// Filtering by these keys must be applied to the entities query, not the
// alerts query — otherwise SQLite throws "no such column".
const ENTITY_COLUMNS = new Set([
  'alert_id',
  'agency_id',
  'stop_id',
  'route_id',
  'route_type',
  'trip_id',
  'direction_id',
]);

/*
 * Returns an array of all service alerts that match the query parameters.
 * Each alert includes a nested `informed_entities` array containing all of
 * its related informed entities.
 *
 * Filters on informed-entity columns (stop_id, route_id, trip_id, route_type,
 * direction_id) are applied to the entities table and only alerts with at
 * least one matching entity are returned.
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
  const orderByClause = formatOrderByClause(orderBy);

  // Split query into alert-level filters and entity-level filters.
  const alertQuery: SqlWhere = {};
  const entityQuery: SqlWhere = {};
  for (const [key, value] of Object.entries(query)) {
    if (ENTITY_COLUMNS.has(key)) {
      entityQuery[key] = value;
    } else {
      alertQuery[key] = value;
    }
  }

  const whereClause = formatWhereClauses(alertQuery);
  const alerts = db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as Omit<ServiceAlert, 'informed_entities'>[];

  const alertIds = alerts.map((alert) => alert.id);
  if (alertIds.length === 0) {
    return [];
  }

  // Build the entities query, combining any entity-level filters with an
  // alert_id IN (...) clause to scope results to the matched alerts.
  const alertIdPlaceholders = alertIds.map(() => '?').join(', ');
  const entityFilterClause = formatWhereClauses(entityQuery);
  const entityWhereClause = entityFilterClause
    ? `${entityFilterClause} AND alert_id IN (${alertIdPlaceholders})`
    : `WHERE alert_id IN (${alertIdPlaceholders})`;

  const entities = db
    .prepare(`SELECT * FROM ${joinTableName} ${entityWhereClause};`)
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

  // When entity-level filters are active, exclude alerts with no matching entities.
  const matchedAlerts =
    Object.keys(entityQuery).length > 0
      ? alerts.filter((alert) => entitiesByAlertId.has(alert.id))
      : alerts;

  return matchedAlerts.map((alert) => ({
    ...alert,
    informed_entities: entitiesByAlertId.get(alert.id) ?? [],
  }));
}
