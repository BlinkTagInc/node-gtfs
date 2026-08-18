import type { Device } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { devices } from '../../schema/tables/tides/devices.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all devices that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getDevices<Fields extends keyof Device>(
  query: RowQuery<Device> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Device> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Device, Fields>(devices, query, fields, orderBy, options);
}
