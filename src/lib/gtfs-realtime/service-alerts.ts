import type {
  ServiceAlert,
  ServiceAlertInformedEntity,
  ServiceAlertRow,
} from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
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
type ServiceAlertQuery = RowQuery<
  ServiceAlertRow & {
    alert_id: string;
    agency_id: string | null;
    stop_id: string | null;
    route_id: string | null;
    route_type: number | null;
    trip_id: string | null;
    direction_id: number | null;
  }
>;

export function getServiceAlerts<Fields extends keyof ServiceAlertRow>(
  query: ServiceAlertQuery = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<ServiceAlertRow> = [],
  options: SqliteQueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'service_alerts';
  const joinTableName = 'service_alert_informed_entities';
  const selectClause = formatSelectClause(fields);
  const orderByClause = formatOrderByClause(orderBy);

  // Split query into alert-level filters and entity-level filters.
  const alertQuery: DynamicQuery = {};
  const entityQuery: DynamicQuery = {};
  for (const [key, value] of Object.entries(query)) {
    if (ENTITY_COLUMNS.has(key)) {
      entityQuery[key] = value;
    } else {
      alertQuery[key] = value;
    }
  }

  const { clause: whereClause, params } = formatWhereClauses(alertQuery);
  const alerts = db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...params) as Omit<ServiceAlert, 'informed_entities'>[];

  const alertIds = alerts.map((alert) => alert.id);
  if (alertIds.length === 0) {
    return [];
  }

  // Build the entities query, combining any entity-level filters with an
  // alert_id IN (...) clause to scope results to the matched alerts.
  const alertIdPlaceholders = alertIds.map(() => '?').join(', ');
  const { clause: entityFilterClause, params: entityFilterParams } =
    formatWhereClauses(entityQuery);
  const entityWhereClause = entityFilterClause
    ? `${entityFilterClause} AND alert_id IN (${alertIdPlaceholders})`
    : `WHERE alert_id IN (${alertIdPlaceholders})`;

  // The entity filters appear before the alert_id list in the statement, so
  // their parameters must bind first.
  const entities = db
    .prepare(`SELECT * FROM ${joinTableName} ${entityWhereClause};`)
    .all(...entityFilterParams, ...alertIds) as ServiceAlertInformedEntity[];

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
