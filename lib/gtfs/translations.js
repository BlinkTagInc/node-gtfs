import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClauses } from '../utils.js';
import translations from '../../models/gtfs/translations.js';

/*
 * Returns an array of all translations that match the query parameters.
 */
export async function getTranslations(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(translations.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}
