import type { FareMedia } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { fareMedia } from '../../schema/tables/gtfs-schedule/fare-media.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all fare media that match the query parameters.
 */
export function getFareMedia<Fields extends keyof FareMedia>(
  query: RowQuery<FareMedia> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<FareMedia> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<FareMedia, Fields>(
    fareMedia,
    query,
    fields,
    orderBy,
    options,
  );
}
