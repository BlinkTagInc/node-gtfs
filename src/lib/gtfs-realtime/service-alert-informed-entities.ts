import type {
  ServiceAlertInformedEntity,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { serviceAlertInformedEntities } from '../../schema/tables/gtfs-realtime/service-alert-informed_entities.ts';
import { findRows } from '../find-rows.ts';

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
  return findRows<ServiceAlertInformedEntity, Fields>(
    serviceAlertInformedEntities,
    query,
    fields,
    orderBy,
    options,
  );
}
