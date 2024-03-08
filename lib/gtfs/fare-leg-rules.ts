import sqlString from 'sqlstring-sqlite';

import { openDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import fareLegRules from '../../models/gtfs/fare-leg-rules.js';

/*
 * Returns an array of all fare leg rules that match the query parameters.
 */
export function getFareLegRules(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? openDb();
  const tableName = sqlString.escapeId(fareLegRules.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
    )
    .all();
}
