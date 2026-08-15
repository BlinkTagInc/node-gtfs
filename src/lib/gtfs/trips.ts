import { omit } from 'lodash-es';
import type {
  QueryOptions,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
  Trip,
  SqlValue,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
} from '../utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from '../errors.ts';
import { getServiceIdsByDate } from './calendars.ts';

/*
 * Returns an array of all trips that match the query parameters.
 */
export function getTrips<Fields extends keyof Trip>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'trips';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const tripQueryOmitKeys = ['date'];

  const tripQuery = omit(query, tripQueryOmitKeys);

  const whereClauses = Object.entries(tripQuery).map(([key, value]) =>
    formatWhereClause(key, value as SqlValue),
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
    whereClauses.push(formatWhereClause('service_id', serviceIds));
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...whereClauses.flatMap(({ params }) => params)) as QueryResult<
    Trip,
    Fields
  >[];
}
