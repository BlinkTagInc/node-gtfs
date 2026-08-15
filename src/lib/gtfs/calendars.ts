import type {
  Calendar,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { calendar } from '../../models/gtfs/calendar.ts';
import { openDb } from '../db.ts';
import { findRows } from '../find-rows.ts';
import { getDayOfWeekFromDate } from '../utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from '../errors.ts';

/*
 * Returns an array of calendars that match the query parameters.
 */
export function getCalendars<Fields extends keyof Calendar>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Calendar, Fields>(calendar, query, fields, orderBy, options);
}

/*
 * Returns an array of service_ids that are active on the given date.
 */
export function getServiceIdsByDate(date: number, options: QueryOptions = {}) {
  const db = options.db ?? openDb();

  if (!date) {
    throw new GtfsError('`date` is a required query parameter', {
      code: GtfsErrorCode.GTFS_QUERY_INVALID,
      category: GtfsErrorCategory.QUERY,
      details: { field: 'date' },
    });
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
