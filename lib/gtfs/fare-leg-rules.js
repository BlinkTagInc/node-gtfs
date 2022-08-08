import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClauses,
} from '../utils.js';
import fareLegRules from '../../models/gtfs/fare-leg-rules.js';

/*
 * Returns an array of all fare leg rules that match the query parameters.
 */
export async function getFareLegRules(
  query = {},
  fields = [],
  orderBy = [],
  options = {}
) {
  const db = options.db ?? (await getDb());
  const tableName = sqlString.escapeId(fareLegRules.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(
    `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`
  );
}
