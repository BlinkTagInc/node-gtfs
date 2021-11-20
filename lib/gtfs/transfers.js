import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import transfers from '../../models/gtfs/transfers.js';

/*
 * Returns an array of all transfers that match the query parameters.
 */
export async function getTransfers(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? (await getDb());
  const tableName = sqlString.escapeId(transfers.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(
    `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
  );
}
