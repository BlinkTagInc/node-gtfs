import { omit } from 'lodash-es';
import type { StopTime } from '../../schema/row-types.ts';
import type {
  QueryScalar,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { openDb } from '../db.ts';
import {
  calculateSecondsFromMidnight,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
} from '../utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from '../errors.ts';
import { getServiceIdsByDate } from './calendars.ts';

/*
 * Returns an array of stoptimes that match the query parameters.
 */
export function getStoptimes<Fields extends keyof StopTime>(
  query: RowQuery<
    StopTime & { date: number; start_time: string; end_time: string }
  > = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<StopTime> = [],
  options: SqliteQueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'stop_times';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const stoptimeQueryOmitKeys = ['date', 'start_time', 'end_time'];

  const stoptimeQuery = omit(query, stoptimeQueryOmitKeys);
  const whereClauses = Object.entries(stoptimeQuery).map(([key, value]) =>
    formatWhereClause(key, value as QueryScalar, tableName),
  );

  if (query.date) {
    if (typeof query.date !== 'number') {
      throw new GtfsError('`date` must be a number in yyyymmdd format', {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.QUERY,
        details: { field: 'date', value: query.date },
      });
    }

    const serviceIds = getServiceIdsByDate(query.date, options);
    const serviceIdClause = formatWhereClause(
      'service_id',
      serviceIds,
      'trips',
    );
    const tripSubquery = `SELECT DISTINCT trip_id FROM trips WHERE ${serviceIdClause.clause}`;

    whereClauses.push({
      clause: `trip_id IN (${tripSubquery})`,
      params: serviceIdClause.params,
    });
  }

  if (query.start_time) {
    if (typeof query.start_time !== 'string') {
      throw new GtfsError('`start_time` must be a string in HH:mm:ss format', {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.QUERY,
        details: { field: 'start_time', value: query.start_time },
      });
    }

    whereClauses.push({
      clause: 'arrival_timestamp >= ?',
      params: [calculateSecondsFromMidnight(query.start_time)],
    });
  }

  if (query.end_time) {
    if (typeof query.end_time !== 'string') {
      throw new GtfsError('`end_time` must be a string in HH:mm:ss format', {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.QUERY,
        details: { field: 'end_time', value: query.end_time },
      });
    }

    whereClauses.push({
      clause: 'departure_timestamp <= ?',
      params: [calculateSecondsFromMidnight(query.end_time)],
    });
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...whereClauses.flatMap(({ params }) => params)) as SelectedRow<
    StopTime,
    Fields
  >[];
}
