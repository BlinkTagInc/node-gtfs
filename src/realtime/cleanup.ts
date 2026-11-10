import { resolveGtfsRealtimeCleanupOptions } from './cleanup-options.ts';
import { beginReportingOperation, report } from '../reporting/report.ts';
import type { GtfsReportingConfig } from '../reporting/types.ts';
import { executeGtfsRealtimeCleanupTransaction } from './cleanup-transaction.ts';
import {
  type GtfsRealtimeCleanupOptions,
  type GtfsRealtimeCleanupResult,
} from './cleanup-types.ts';
import { GTFS_REALTIME_CURRENT_STATE_TABLES } from './entity-tables.ts';

export type {
  GtfsInstanceRealtimeCleanupOptions,
  GtfsRealtimeCleanupOptions,
  GtfsRealtimeCleanupResult,
  GtfsRealtimeCleanupTable,
} from './cleanup-types.ts';

function beginGtfsRealtimeCleanupReporting(
  reporting: GtfsReportingConfig,
  sourceIds: readonly string[] | undefined,
): bigint {
  beginReportingOperation(reporting);
  const startTime = process.hrtime.bigint();
  report(reporting, {
    type: 'operation:start',
    operation: 'cleanup',
    ...(sourceIds === undefined
      ? {}
      : { sourceCount: sourceIds.length, sourceIds }),
  });
  return startTime;
}

function completeGtfsRealtimeCleanupReporting(
  reporting: GtfsReportingConfig,
  startTime: bigint,
  result: GtfsRealtimeCleanupResult,
): void {
  report(reporting, {
    type: 'operation:complete',
    operation: 'cleanup',
    durationMs: Number((process.hrtime.bigint() - startTime) / 1_000_000n),
    summary: `${result.totalRowsDeleted} rows deleted`,
    result: {
      nowUnixSeconds: result.nowUnixSeconds,
      currentStateRowsDeleted: result.currentStateRowsDeleted,
      snapshotHistoryRowsDeleted: result.snapshotHistoryRowsDeleted,
      totalRowsDeleted: result.totalRowsDeleted,
    },
  });
}

/**
 * Removes expired GTFS-Realtime current state and retained snapshot history in
 * one portable transaction. Child and orphan rows are removed explicitly; no
 * foreign-key cascade behavior is assumed.
 */
export async function cleanupGtfsRealtime<DB>(
  options: GtfsRealtimeCleanupOptions<DB>,
): Promise<GtfsRealtimeCleanupResult> {
  const resolved = resolveGtfsRealtimeCleanupOptions(options);
  const startTime = beginGtfsRealtimeCleanupReporting(
    resolved.reporting,
    resolved.sourceIds,
  );
  const deletedRowsByTable = await executeGtfsRealtimeCleanupTransaction(
    options.database,
    resolved,
  );
  const currentStateRowsDeleted = GTFS_REALTIME_CURRENT_STATE_TABLES.reduce(
    (total, table) => total + deletedRowsByTable[table],
    0,
  );
  const snapshotHistoryRowsDeleted =
    deletedRowsByTable.realtime_feed_entities +
    deletedRowsByTable.realtime_snapshots;
  const result = {
    nowUnixSeconds: resolved.nowUnixSeconds,
    deletedRowsByTable: Object.freeze({ ...deletedRowsByTable }),
    currentStateRowsDeleted,
    snapshotHistoryRowsDeleted,
    totalRowsDeleted: currentStateRowsDeleted + snapshotHistoryRowsDeleted,
  };

  completeGtfsRealtimeCleanupReporting(resolved.reporting, startTime, result);
  return result;
}
