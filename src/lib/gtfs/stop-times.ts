import { omit } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';
import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  StopTime,
  SqlValue,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  calculateSecondsFromMidnight,
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
} from '../utils.ts';
import { getServiceIdsByDate } from './calendars.ts';

/*
 * Returns an array of stoptimes that match the query parameters.
 */
export function getStoptimes<Fields extends keyof StopTime>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'stop_times';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const stoptimeQueryOmitKeys = ['date', 'start_time', 'end_time'];

  const stoptimeQuery = omit(query, stoptimeQueryOmitKeys);
  const whereClauses = Object.entries(stoptimeQuery).map(([key, value]) =>
    formatWhereClause(key, value as SqlValue),
  );

  if (query.date) {
    if (typeof query.date !== 'number') {
      throw new Error('`date` must be a number in yyyymmdd format');
    }

    const serviceIds = getServiceIdsByDate(query.date, options);

    const tripSubquery = `SELECT DISTINCT trip_id FROM trips WHERE service_id IN (${serviceIds.map((id) => sqlString.escape(id)).join(',')})`;

    whereClauses.push(`trip_id IN (${tripSubquery})`);
  }

  if (query.start_time) {
    if (typeof query.start_time !== 'string') {
      throw new Error('`start_time` must be a string in HH:mm:ss format');
    }

    whereClauses.push(
      `arrival_timestamp >= ${calculateSecondsFromMidnight(query.start_time)}`,
    );
  }

  if (query.end_time) {
    if (typeof query.end_time !== 'string') {
      throw new Error('`end_time` must be a string in HH:mm:ss format');
    }

    whereClauses.push(
      `departure_timestamp <= ${calculateSecondsFromMidnight(query.end_time)}`,
    );
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<StopTime, Fields>[];
}
