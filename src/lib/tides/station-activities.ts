import type { StationActivity } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { stationActivities } from '../../schema/tables/tides/station-activities.ts';
import { findRows } from '../find-rows.ts';

export function getStationActivities<Fields extends keyof StationActivity>(
  query: RowQuery<StationActivity> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StationActivity> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<StationActivity, Fields>(
    stationActivities,
    query,
    fields,
    orderBy,
    options,
  );
}
