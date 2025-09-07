import { omit } from 'lodash-es';
import sqlString from 'sqlstring-sqlite';
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
      throw new Error('`date` must be a number in yyyymmdd format');
    }

    const serviceIds = getServiceIdsByDate(query.date, options);

    whereClauses.push(
      `service_id IN (${serviceIds.map((id) => sqlString.escape(id)).join(',')})`,
    );
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<Trip, Fields>[];
}
