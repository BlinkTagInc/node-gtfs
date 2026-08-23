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
import { compiledTableRegistry } from '../../schema/table-registry.ts';
import { selectRows } from '../sqlite-query.ts';
import { formatWhereCondition, formatWhereConditions } from '../sql-clauses.ts';

const alertColumns = new Set(
  compiledTableRegistry.serviceAlerts.columns.map((column) => column.name),
);
const entityColumns = new Set(
  compiledTableRegistry.serviceAlertInformedEntities.columns
    .map((column) => column.name)
    .filter((columnName) => !alertColumns.has(columnName)),
);

type ServiceAlertQuery = RowQuery<ServiceAlertRow & ServiceAlertInformedEntity>;

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
    if (entityColumns.has(key)) {
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
