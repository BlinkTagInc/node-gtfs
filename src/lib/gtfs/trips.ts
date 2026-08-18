import { omit } from 'lodash-es';
import type { Trip } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { requireQueryType, selectRows } from '../sqlite-query.ts';
import { formatWhereCondition, formatWhereConditions } from '../sql-clauses.ts';
import { getServiceIdsByDate } from './calendars.ts';

/**
 * Returns an array of all trips that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTrips<Fields extends keyof Trip>(
  query: RowQuery<Trip & { date: number }> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Trip> = [],
  options: SqliteQueryOptions = {},
) {
  const tableName = 'trips';
  const where = formatWhereConditions(
    omit(query, ['date']) as DynamicQuery,
    tableName,
  );

  if (query.date) {
    const date = requireQueryType('date', query.date, 'number', 'yyyymmdd');
    const serviceIds = getServiceIdsByDate(date, options);
    where.push(formatWhereCondition('service_id', serviceIds, tableName));
  }

  return selectRows<Trip, Fields>(
    tableName,
    { fields, where, orderBy },
    options,
  );
}
