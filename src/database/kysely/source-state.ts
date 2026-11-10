import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { sourceStateTable, realtimeTableNames } from '../source-state.ts';
import { asDynamicKysely } from '../clients.ts';
import {
  getGtfsTableStoragePlan,
  type GtfsStoragePlan,
} from '../storage/plan.ts';
import { projectGtfsStorageRow } from '../storage/row-projection.ts';
import { deleteKyselySourceData } from './source-data.ts';

export async function readKyselyScheduleRevision<DB>(
  database: Kysely<DB>,
  sourceId: string,
): Promise<string | null> {
  const result = await sql<{
    schedule_revision: string | null;
  }>`select schedule_revision from ${sql.table(sourceStateTable.tableName)} where source_id = ${sourceId}`.execute(
    database,
  );
  return result.rows[0]?.schedule_revision ?? null;
}

export async function lockKyselySource<DB>(
  database: Kysely<DB>,
  sourceId: string,
  plan: GtfsStoragePlan,
): Promise<string | null> {
  const row = projectGtfsStorageRow(
    getGtfsTableStoragePlan(plan, sourceStateTable.tableName),
    { source_id: sourceId },
  );
  const insert = asDynamicKysely(database)
    .insertInto(sourceStateTable.tableName)
    .values(row);
  if (plan.dialect === 'mysql') {
    await insert.onDuplicateKeyUpdate({ source_id: sourceId }).execute();
  } else {
    await insert
      .onConflict((conflict) => conflict.column('source_id').doNothing())
      .execute();
  }
  // A locking read observes the latest committed revision even under MySQL's
  // default repeatable-read isolation; the lock is held until commit/rollback.
  const result = await sql<{
    schedule_revision: string | null;
  }>`select schedule_revision from ${sql.table(sourceStateTable.tableName)} where source_id = ${sourceId} ${plan.dialect === 'sqlite' ? sql`` : sql`for update`}`.execute(
    database,
  );
  return result.rows[0]?.schedule_revision ?? null;
}

export async function invalidateKyselySourceRealtime<DB>(
  database: Kysely<DB>,
  sourceId: string,
  plan: GtfsStoragePlan,
): Promise<void> {
  await sql`update ${sql.table(sourceStateTable.tableName)} set schedule_revision = ${randomUUID()} where source_id = ${sourceId}`.execute(
    database,
  );
  const query =
    plan.dialect === 'sqlite'
      ? sql<{
          name: string;
        }>`select name from sqlite_schema where type = 'table'`
      : sql<{
          name: string;
        }>`select table_name as name from information_schema.tables where table_schema = ${plan.dialect === 'postgres' ? sql`current_schema()` : sql`database()`} and table_type = 'BASE TABLE'`;
  const existing = new Set(
    (await query.execute(database)).rows.map(({ name }) => name),
  );
  await deleteKyselySourceData({
    database,
    sourceId,
    tableNames: realtimeTableNames.filter((table) => existing.has(table)),
  });
}
