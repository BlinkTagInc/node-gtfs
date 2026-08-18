import type { Device } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { devices } from '../../schema/tables/tides/devices.ts';
import { findRows } from '../find-rows.ts';

export function getDevices<Fields extends keyof Device>(
  query: RowQuery<Device> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Device> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Device, Fields>(devices, query, fields, orderBy, options);
}
