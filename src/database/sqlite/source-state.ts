import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { sourceStateTable, realtimeTableNames } from '../source-state.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import { deleteSqliteSourceData } from './source-data.ts';

const tableName = quoteSqliteIdentifier(sourceStateTable.tableName);

export function readSqliteScheduleRevision(
  database: Database.Database,
  sourceId: string,
): string | null {
  const row = database
    .prepare(`SELECT schedule_revision FROM ${tableName} WHERE source_id = ?`)
    .get(sourceId) as { schedule_revision: string | null } | undefined;
  return row?.schedule_revision ?? null;
}

// The insert takes a write lock before reading the revision. Both writers call
// this inside their transaction, so the lock lasts through all data changes.
export function lockSqliteSource(
  database: Database.Database,
  sourceId: string,
): string | null {
  database
    .prepare(
      `INSERT INTO ${tableName} (source_id) VALUES (?) ON CONFLICT (source_id) DO NOTHING`,
    )
    .run(sourceId);
  return readSqliteScheduleRevision(database, sourceId);
}

export async function invalidateSqliteSourceRealtime(
  database: Database.Database,
  sourceId: string,
): Promise<void> {
  database
    .prepare(
      `UPDATE ${tableName} SET schedule_revision = ? WHERE source_id = ?`,
    )
    .run(randomUUID(), sourceId);
  const existing = new Set(
    (
      database
        .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
        .all() as { name: string }[]
    ).map(({ name }) => name),
  );
  await deleteSqliteSourceData({
    database,
    sourceId,
    tableNames: realtimeTableNames.filter((table) => existing.has(table)),
  });
}
