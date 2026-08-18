import { omit } from 'lodash-es';
import type { StopTime } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { requireQueryType, selectRows } from '../sqlite-query.ts';
import { formatWhereConditions } from '../sql-clauses.ts';
import { calculateSecondsFromMidnight } from '../time-utils.ts';
import { getServiceIdsByDate } from './calendars.ts';
import { tripIdsForServiceIds } from './subqueries.ts';

/**
 * Returns an array of stoptimes that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getStoptimes<Fields extends keyof StopTime>(
  query: RowQuery<
    StopTime & { date: number; start_time: string; end_time: string }
  > = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopTime> = [],
  options: SqliteQueryOptions = {},
) {
  const tableName = 'stop_times';
  const where = formatWhereConditions(
    omit(query, ['date', 'start_time', 'end_time']) as DynamicQuery,
    tableName,
  );

  if (query.date) {
    const date = requireQueryType('date', query.date, 'number', 'yyyymmdd');
    const tripIds = tripIdsForServiceIds(getServiceIdsByDate(date, options));
    where.push({
      clause: `trip_id IN (${tripIds.clause})`,
      params: tripIds.params,
    });
  }

  if (query.start_time) {
    const startTime = requireQueryType(
      'start_time',
      query.start_time,
      'string',
      'HH:mm:ss',
    );
    where.push({
      clause: 'arrival_timestamp >= ?',
      params: [calculateSecondsFromMidnight(startTime)],
    });
  }

  if (query.end_time) {
    const endTime = requireQueryType(
      'end_time',
      query.end_time,
      'string',
      'HH:mm:ss',
    );
    where.push({
      clause: 'departure_timestamp <= ?',
      params: [calculateSecondsFromMidnight(endTime)],
    });
  }

  return selectRows<StopTime, Fields>(
    tableName,
    { fields, where, orderBy },
    options,
  );
}
