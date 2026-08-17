import type { ServiceAlertInformedEntity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { serviceAlertInformedEntities } from '../../schema/tables/gtfs-realtime/service-alert-informed_entities.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all service alert informed entities that match the query parameters.
 */
export function getServiceAlertInformedEntities<
  Fields extends keyof ServiceAlertInformedEntity,
>(
  query: RowQuery<ServiceAlertInformedEntity> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<ServiceAlertInformedEntity> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<ServiceAlertInformedEntity, Fields>(
    serviceAlertInformedEntities,
    query,
    fields,
    orderBy,
    options,
  );
}
