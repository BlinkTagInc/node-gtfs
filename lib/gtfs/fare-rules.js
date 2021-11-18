import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import fareRules from '../../models/gtfs/fare-rules.js';

/*
 * Returns an array of all fare rules that match the query parameters.
 */
export async function getFareRules(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? (await getDb());
  const tableName = sqlString.escapeId(fareRules.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(
    `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
  );
}
