import {
  cancellationCheckpoint,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import { runKyselyTransaction } from './transaction.ts';
import { sql, type Kysely } from 'kysely';

import { compiledTableRegistry } from '../../schema/table-registry.ts';
import {
  getStorageKeyColumnNames,
  type CompiledGtfsTable,
} from '../../schema/compile-table.ts';
import type {
  GtfsRealtimeWriter,
  NormalizedRealtimeRow,
  RealtimeMutation,
  RealtimeSnapshotApplication,
  RealtimeSnapshotEntity,
  RealtimeWriteResult,
} from '../../realtime/writer.ts';
import { asDynamicKysely, type GtfsDynamicKysely } from '../clients.ts';
import {
  getGtfsTableStoragePlan,
  type GtfsStoragePlan,
} from '../storage/plan.ts';
import { projectGtfsStorageRow } from '../storage/row-projection.ts';
import {
  createRealtimeFeedEntityRow,
  createRealtimeSnapshotRow,
} from '../storage/realtime.ts';
import { GTFS_REALTIME_CURRENT_STATE_TABLES } from '../../realtime/entity-tables.ts';
import { assertScheduleRevision } from '../source-state.ts';
import {
  lockKyselySource,
  readKyselyScheduleRevision,
} from './source-state.ts';

async function insertRow({
  database,
  table,
  row,
  plan,
}: {
  database: GtfsDynamicKysely;
  table: CompiledGtfsTable;
  row: NormalizedRealtimeRow;
  plan: GtfsStoragePlan;
}): Promise<void> {
  const tablePlan = getGtfsTableStoragePlan(plan, table.tableName);
  const columnNames = tablePlan.columnNames;
  const storedRow = projectGtfsStorageRow(tablePlan, row);
  await sql`
    insert into ${sql.table(table.tableName)}
      (${sql.join(columnNames.map((name) => sql.ref(name)))})
    values
      (${sql.join(columnNames.map((name) => storedRow[name] ?? null))})
  `.execute(database);
}

async function deleteMutation(
  database: GtfsDynamicKysely,
  mutation: Extract<RealtimeMutation, { operation: 'delete' }>,
): Promise<void> {
  const predicates = mutation.where.map(({ field, value, nullSafe }) =>
    value === null && nullSafe
      ? sql`${sql.ref(field)} is null`
      : sql`${sql.ref(field)} = ${value}`,
  );
  await sql`
    delete from ${sql.table(mutation.table.tableName)}
    where ${sql.join(predicates, sql` and `)}
  `.execute(database);
}

async function applyMutation({
  database,
  mutation,
  plan,
}: {
  database: GtfsDynamicKysely;
  mutation: RealtimeMutation;
  plan: GtfsStoragePlan;
}): Promise<number> {
  if (mutation.operation === 'delete') {
    await deleteMutation(database, mutation);
    return 0;
  }

  const keyFields = getStorageKeyColumnNames(mutation.table).filter(
    (field) => field !== 'source_id',
  );
  const sourceId = mutation.row.source_id;
  if (typeof sourceId !== 'string') {
    throw new TypeError('Realtime mutation rows require a string source_id');
  }
  await deleteMutation(database, {
    operation: 'delete',
    table: mutation.table,
    where: [
      { field: 'source_id', value: sourceId },
      ...keyFields.map((field) => ({
        field,
        value: mutation.row[field] ?? null,
        nullSafe: true,
      })),
    ],
  });
  await insertRow({ database, table: mutation.table, row: mutation.row, plan });
  return 1;
}

async function writeCurrentEntities(
  database: GtfsDynamicKysely,
  entities: readonly RealtimeSnapshotEntity[],
  plan: GtfsStoragePlan,
): Promise<number> {
  let recordCount = 0;
  for (const entity of entities) {
    await cancellationCheckpoint();
    for (const mutation of entity.currentMutations) {
      throwIfOperationAborted();
      recordCount += await applyMutation({ database, mutation, plan });
    }
  }
  return recordCount;
}

async function upsertRealtimeFeed(
  database: GtfsDynamicKysely,
  snapshot: RealtimeSnapshotApplication,
  plan: GtfsStoragePlan,
): Promise<void> {
  const existing = await sql`
    select created_at_unix_seconds
    from ${sql.table('realtime_feeds')}
    where source_id = ${snapshot.sourceId}
      and realtime_feed_id = ${snapshot.realtimeFeedId}
  `.execute(database);

  if (existing.rows.length === 0) {
    await insertRow({
      database,
      table: compiledTableRegistry.realtimeFeeds,
      row: {
        source_id: snapshot.sourceId,
        realtime_feed_id: snapshot.realtimeFeedId,
        feed_type: snapshot.feedType,
        feed_url: snapshot.feedUrl,
        source_metadata: null,
        created_at_unix_seconds: snapshot.fetchedAtUnixSeconds,
        updated_at_unix_seconds: snapshot.fetchedAtUnixSeconds,
      },
      plan,
    });
    return;
  }

  await sql`
    update ${sql.table('realtime_feeds')}
    set feed_type = ${snapshot.feedType},
        feed_url = ${snapshot.feedUrl},
        updated_at_unix_seconds = ${snapshot.fetchedAtUnixSeconds}
    where source_id = ${snapshot.sourceId}
      and realtime_feed_id = ${snapshot.realtimeFeedId}
  `.execute(database);
}

async function applySnapshot(
  database: GtfsDynamicKysely,
  snapshot: RealtimeSnapshotApplication,
  plan: GtfsStoragePlan,
): Promise<RealtimeWriteResult> {
  const { realtimeFeedEntities, realtimeSnapshots } = compiledTableRegistry;
  const existing = await sql`
    select 1
    from ${sql.table('realtime_snapshots')}
    where source_id = ${snapshot.sourceId}
      and realtime_feed_id = ${snapshot.realtimeFeedId}
      and snapshot_id = ${snapshot.snapshotId}
  `.execute(database);
  if (existing.rows.length > 0) {
    return { recordCount: 0, errors: [], duplicateSnapshot: true };
  }

  await upsertRealtimeFeed(database, snapshot, plan);
  await insertRow({
    database,
    table: realtimeSnapshots,
    row: createRealtimeSnapshotRow(snapshot),
    plan,
  });

  for (const entity of snapshot.entities) {
    await cancellationCheckpoint();
    await insertRow({
      database,
      table: realtimeFeedEntities,
      row: createRealtimeFeedEntityRow(snapshot, entity),
      plan,
    });
  }

  if (snapshot.applicationMode === 'full') {
    for (const tableName of GTFS_REALTIME_CURRENT_STATE_TABLES) {
      await sql`
        delete from ${sql.table(tableName)}
        where source_id = ${snapshot.sourceId}
          and realtime_feed_id = ${snapshot.realtimeFeedId}
      `.execute(database);
    }
  }

  const recordCount =
    snapshot.applicationMode === 'history-only'
      ? 0
      : await writeCurrentEntities(database, snapshot.entities, plan);
  return { recordCount, errors: [], duplicateSnapshot: false };
}

/** Creates a transactionally portable GTFS-Realtime snapshot writer. */
export function createKyselyGtfsRealtimeWriter<DB>(
  database: Kysely<DB>,
  storagePlan: GtfsStoragePlan,
): GtfsRealtimeWriter {
  const dynamicDatabase = asDynamicKysely(database);
  return {
    readScheduleRevision(sourceId) {
      return readKyselyScheduleRevision(database, sourceId);
    },
    async applySnapshot(snapshot, scheduleRevision) {
      try {
        const apply = async (transaction: GtfsDynamicKysely) => {
          assertScheduleRevision({
            sourceId: snapshot.sourceId,
            expected: scheduleRevision,
            actual: await lockKyselySource(
              transaction,
              snapshot.sourceId,
              storagePlan,
            ),
          });
          await cancellationCheckpoint();
          const result = await applySnapshot(
            transaction,
            snapshot,
            storagePlan,
          );
          throwIfOperationAborted();
          return result;
        };
        return await runKyselyTransaction(dynamicDatabase, apply);
      } catch (error: unknown) {
        return {
          recordCount: 0,
          errors: [error],
          duplicateSnapshot: false,
        };
      }
    },
  };
}
