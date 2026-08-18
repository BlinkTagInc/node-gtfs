import type { TripPerformed } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { tripsPerformed } from '../../schema/tables/tides/trips-performed.ts';
import { findRows } from '../find-rows.ts';

export function getTripsPerformed<Fields extends keyof TripPerformed>(
  query: RowQuery<TripPerformed> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<TripPerformed> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<TripPerformed, Fields>(
    tripsPerformed,
    query,
    fields,
    orderBy,
    options,
  );
}
