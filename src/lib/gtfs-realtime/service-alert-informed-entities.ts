import type { ServiceAlertInformedEntity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { serviceAlertInformedEntities } from '../../schema/tables/gtfs-realtime/service-alert-informed_entities.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all service alert informed entities that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
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
