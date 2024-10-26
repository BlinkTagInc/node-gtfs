import type {
  Calendar,
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
  getDayOfWeekFromDate,
} from '../utils.ts';

/*
 * Returns an array of calendars that match the query parameters.
 */
export function getCalendars<Fields extends keyof Calendar>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'calendar';
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<Calendar, Fields>[];
}

/*
 * Returns an array of service_ids that are active on the given date.
 */
export function getServiceIdsByDate(date: number, options: QueryOptions = {}) {
  const db = options.db ?? openDb();

  if (!date) {
    throw new Error('`date` is a required query parameter');
  }

  const dayOfWeek = getDayOfWeekFromDate(date as number);

  const results = db
    .prepare(
      `
    SELECT service_id FROM (
      SELECT service_id
      FROM calendar
      WHERE start_date <= ? AND end_date >= ? AND ${dayOfWeek} = 1
      UNION
      SELECT service_id
      FROM calendar_dates
      WHERE date = ? AND exception_type = 1
    )
    EXCEPT
    SELECT service_id
    FROM calendar_dates
    WHERE date = ? AND exception_type = 2
  `,
    )
    .all(date, date, date, date) as { service_id: string }[];

  return results.map((record) => record.service_id);
}
