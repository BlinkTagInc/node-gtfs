import {
  cancellationCheckpoint,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import { runSqliteTransaction } from './transaction.ts';
import Database from 'better-sqlite3';

import type {
  GtfsRealtimeWriter,
  NormalizedRealtimeRow,
  RealtimeSnapshotApplication,
  RealtimeMutation,
} from '../../realtime/writer.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import { compiledTableRegistry } from '../../schema/table-registry.ts';
import {
  createGtfsStoragePlan,
  getGtfsTableStoragePlan,
  type GtfsStoragePlan,
} from '../storage/plan.ts';
import { createGtfsStorageValuesProjector } from '../storage/row-projection.ts';
import {
  createRealtimeFeedEntityRow,
  createRealtimeSnapshotRow,
} from '../storage/realtime.ts';
import { GTFS_REALTIME_CURRENT_STATE_TABLES } from '../../realtime/entity-tables.ts';
import { assertScheduleRevision } from '../source-state.ts';
import {
  lockSqliteSource,
  readSqliteScheduleRevision,
} from './source-state.ts';
import { withSqliteOperationLock } from './operation-lock.ts';

export function createSqliteGtfsRealtimeWriter(
  database: Database.Database,
  storagePlan: GtfsStoragePlan = createGtfsStoragePlan({
    dialect: 'sqlite',
    extensions: ['gtfs-realtime'],
  }),
): GtfsRealtimeWriter {
  const { realtimeFeedEntities, realtimeSnapshots } = compiledTableRegistry;
  const writeBindings = new Map<
    string,
    {
      statement: Database.Statement;
      projectValues: ReturnType<typeof createGtfsStorageValuesProjector>;
    }
  >();
  const deleteStatements = new Map<string, Database.Statement>();

  function runWrite(
    operation: 'INSERT' | 'REPLACE',
    tableName: string,
    row: NormalizedRealtimeRow,
  ): void {
    const cacheKey = `${operation}:${tableName}`;
    let binding = writeBindings.get(cacheKey);
    if (binding === undefined) {
      const tablePlan = getGtfsTableStoragePlan(storagePlan, tableName);
      const columns = tablePlan.columns.filter(
        ({ role }) => role !== 'service-time',
      );
      binding = {
        statement: database.prepare(
          `${operation} INTO ${quoteSqliteIdentifier(tableName)} (${columns
            .map(({ name }) => quoteSqliteIdentifier(name))
            .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        ),
        projectValues: createGtfsStorageValuesProjector(tablePlan, columns),
      };
      writeBindings.set(cacheKey, binding);
    }
    binding.statement.run(binding.projectValues(row));
  }

  function runMutation(mutation: RealtimeMutation): void {
    if (mutation.operation === 'replace') {
      runWrite('REPLACE', mutation.table.tableName, mutation.row);
      return;
    }

    const cacheKey = `${mutation.table.tableName}:${mutation.where
      .map(({ field, nullSafe }) => `${field}:${Boolean(nullSafe)}`)
      .join(',')}`;
    let statement = deleteStatements.get(cacheKey);
    if (!statement) {
      const whereClause = mutation.where
        .map(
          ({ field, nullSafe }) =>
            `${quoteSqliteIdentifier(field)} ${nullSafe ? 'IS' : '='} ?`,
        )
        .join(' AND ');
      statement = database.prepare(
        `DELETE FROM ${quoteSqliteIdentifier(mutation.table.tableName)} WHERE ${whereClause}`,
      );
      deleteStatements.set(cacheKey, statement);
    }
    statement.run(mutation.where.map(({ value }) => value));
  }

  const snapshotExists = database.prepare(
    `SELECT 1 FROM realtime_snapshots
     WHERE source_id = ? AND realtime_feed_id = ? AND snapshot_id = ?`,
  );
  const upsertRealtimeFeed = database.prepare(
    `INSERT INTO realtime_feeds (
       source_id, realtime_feed_id, feed_type, feed_url, source_metadata,
       created_at_unix_seconds, updated_at_unix_seconds
     ) VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(source_id, realtime_feed_id) DO UPDATE SET
       feed_type = excluded.feed_type,
       feed_url = excluded.feed_url,
       updated_at_unix_seconds = excluded.updated_at_unix_seconds`,
  );
  const clearCurrentStatements = GTFS_REALTIME_CURRENT_STATE_TABLES.map(
    (table) =>
      database.prepare(
        `DELETE FROM ${quoteSqliteIdentifier(table)}
       WHERE source_id = ? AND realtime_feed_id = ?`,
      ),
  );

  const applySnapshotTransaction = async (
    snapshot: RealtimeSnapshotApplication,
    scheduleRevision: string | null,
  ) => {
    await cancellationCheckpoint();
    assertScheduleRevision({
      sourceId: snapshot.sourceId,
      expected: scheduleRevision,
      actual: lockSqliteSource(database, snapshot.sourceId),
    });
    if (
      snapshotExists.get(
        snapshot.sourceId,
        snapshot.realtimeFeedId,
        snapshot.snapshotId,
      ) !== undefined
    ) {
      return {
        recordCount: 0,
        errors: [],
        duplicateSnapshot: true,
      };
    }

    upsertRealtimeFeed.run(
      snapshot.sourceId,
      snapshot.realtimeFeedId,
      snapshot.feedType,
      snapshot.feedUrl,
      snapshot.fetchedAtUnixSeconds,
      snapshot.fetchedAtUnixSeconds,
    );
    runWrite(
      'INSERT',
      realtimeSnapshots.tableName,
      createRealtimeSnapshotRow(snapshot),
    );

    for (const [entityIndex, entity] of snapshot.entities.entries()) {
      if (entityIndex % 512 === 0) {
        await cancellationCheckpoint();
      }
      runWrite(
        'INSERT',
        realtimeFeedEntities.tableName,
        createRealtimeFeedEntityRow(snapshot, entity),
      );
    }

    if (snapshot.applicationMode === 'full') {
      for (const statement of clearCurrentStatements) {
        statement.run(snapshot.sourceId, snapshot.realtimeFeedId);
      }
    }

    let recordCount = 0;
    let mutationCount = 0;
    if (snapshot.applicationMode !== 'history-only') {
      for (const [entityIndex, entity] of snapshot.entities.entries()) {
        if (entityIndex % 512 === 0) {
          await cancellationCheckpoint();
        }
        for (const mutation of entity.currentMutations) {
          if (mutationCount++ % 512 === 0) {
            await cancellationCheckpoint();
          }
          runMutation(mutation);
          if (mutation.operation === 'replace') {
            recordCount += 1;
          }
        }
      }
    }

    throwIfOperationAborted();
    return { recordCount, errors: [], duplicateSnapshot: false };
  };

  return {
    readScheduleRevision(sourceId) {
      return withSqliteOperationLock(database, () =>
        readSqliteScheduleRevision(database, sourceId),
      );
    },
    async applySnapshot(snapshot, scheduleRevision) {
      try {
        return await withSqliteOperationLock(database, () =>
          runSqliteTransaction(database, () =>
            applySnapshotTransaction(snapshot, scheduleRevision),
          ),
        );
      } catch (error: unknown) {
        return { recordCount: 0, errors: [error], duplicateSnapshot: false };
      }
    },
  };
}
