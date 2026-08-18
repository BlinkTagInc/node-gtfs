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
import { selectRows } from '../sqlite-query.ts';
import { formatWhereCondition, formatWhereConditions } from '../sql-clauses.ts';

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

/**
 * Returns an array of all service alerts that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getServiceAlerts<Fields extends keyof ServiceAlertRow>(
  query: ServiceAlertQuery = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<ServiceAlertRow> = [],
  options: SqliteQueryOptions = {},
) {
  const tableName = 'service_alerts';
  const joinTableName = 'service_alert_informed_entities';

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

  const alerts = selectRows<ServiceAlertRow, Fields>(
    tableName,
    {
      fields,
      where: formatWhereConditions(alertQuery, tableName),
      orderBy,
    },
    options,
  ) as unknown as Omit<ServiceAlert, 'informed_entities'>[];

  const alertIds = alerts.map((alert) => alert.id);
  if (alertIds.length === 0) {
    return [];
  }

  // Entity-level filters bind before the alert_id list, scoping the entities
  // to the alerts that matched.
  const entities = selectRows<ServiceAlertInformedEntity, never>(
    joinTableName,
    {
      fields: [],
      where: [
        ...formatWhereConditions(entityQuery, joinTableName),
        formatWhereCondition('alert_id', alertIds, joinTableName),
      ],
      orderBy: [],
    },
    options,
  ) as ServiceAlertInformedEntity[];

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
