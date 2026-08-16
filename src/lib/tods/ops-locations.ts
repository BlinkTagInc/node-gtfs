import type {
  OpsLocation,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { opsLocations } from '../../schema/tables/tods/ops-locations.ts';
import { findRows } from '../find-rows.ts';

export function getOpsLocations<Fields extends keyof OpsLocation>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<OpsLocation, Fields>(
    opsLocations,
    query,
    fields,
    orderBy,
    options,
  );
}
