import type { StopVisit } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stopVisits } from '../../schema/tables/tides/stop-visits.ts';
import { findRows } from '../find-rows.ts';

export function getStopVisits<Fields extends keyof StopVisit>(
  query: RowQuery<StopVisit> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopVisit> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StopVisit, Fields>(
    stopVisits,
    query,
    fields,
    orderBy,
    options,
  );
}
