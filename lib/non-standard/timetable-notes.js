import sqlString from 'sqlstring-sqlite';

import { getDb } from '../db.js';

import { formatOrderByClause, formatSelectClause, formatWhereClauses } from '../utils.js';
import timetableNotes from '../../models/non-standard/timetable-notes.js';

/*
 * Returns an array of all timetable notes that match the query parameters.
 */
export async function getTimetableNotes(query = {}, fields = [], orderBy = []) {
  const db = await getDb();
  const tableName = sqlString.escapeId(timetableNotes.filenameBase);
  const selectClause = formatSelectClause(fields);
  const whereClause = formatWhereClauses(query);
  const orderByClause = formatOrderByClause(orderBy);

  return db.all(`${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`);
}
