import type { OpsLocation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { opsLocations } from '../../schema/tables/tods/ops-locations.ts';
import { findRows } from '../find-rows.ts';

export function getOpsLocations<Fields extends keyof OpsLocation>(
  query: RowQuery<OpsLocation> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<OpsLocation> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<OpsLocation, Fields>(
    opsLocations,
    query,
    fields,
    orderBy,
    options,
  );
}
