import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { GtfsRealtimeFeedType } from '../types/config.ts';

export type NormalizedRealtimeValue =
  string | number | bigint | Uint8Array | null;

export type NormalizedRealtimeRow = Readonly<
  Record<string, NormalizedRealtimeValue>
>;

export type RealtimeEntityType =
  | 'alert'
  | 'trip_update'
  | 'vehicle_position'
  | 'shape'
  | 'stop'
  | 'trip_modifications'
  | 'unknown';

export interface RealtimeSnapshotEntity {
  readonly entityOrdinal: number;
  readonly entityId: string | null;
  readonly entityType: RealtimeEntityType;
  readonly isDeleted: boolean;
  /** Parsed FeedEntity JSON retained independently from current query rows. */
  readonly entityJson: string;
  /** Empty when an entity is retained as history but cannot be applied safely. */
  readonly currentMutations: readonly RealtimeMutation[];
}

export interface RealtimeSnapshotApplication {
  readonly sourceId: string;
  readonly realtimeFeedId: string;
  readonly feedType: GtfsRealtimeFeedType;
  readonly feedUrl: string;
  readonly snapshotId: string;
  readonly fetchedAtUnixSeconds: number;
  readonly httpStatus: number | null;
  readonly httpHeaders: string | null;
  readonly contentType: string | null;
  readonly feedHeaderVersion: string | null;
  readonly feedHeaderIncrementality: string;
  readonly feedHeaderUnixSeconds: NormalizedRealtimeValue;
  readonly payloadSha256: string;
  readonly rawPayloadBase64: string;
  /** Unix time at which retained raw history may be deleted; null retains it. */
  readonly retentionExpiresAtUnixSeconds: number | null;
  /** Unknown incremental modes retain history without changing current rows. */
  readonly applicationMode: 'full' | 'differential' | 'history-only';
  readonly entities: readonly RealtimeSnapshotEntity[];
}

interface RealtimeDeletePredicate {
  readonly field: string;
  readonly value: NormalizedRealtimeValue;
  readonly nullSafe?: boolean;
}

export type RealtimeMutation =
  | Readonly<{
      operation: 'delete';
      table: CompiledGtfsTable;
      where: readonly RealtimeDeletePredicate[];
    }>
  | Readonly<{
      operation: 'replace';
      table: CompiledGtfsTable;
      row: NormalizedRealtimeRow;
    }>;

export interface RealtimeWriteResult {
  readonly recordCount: number;
  readonly errors: readonly unknown[];
  readonly duplicateSnapshot?: boolean;
}

export interface GtfsRealtimeWriter {
  readScheduleRevision(
    sourceId: string,
  ): string | null | Promise<string | null>;
  /** Atomically retains one snapshot and updates its current query projection. */
  applySnapshot(
    snapshot: RealtimeSnapshotApplication,
    scheduleRevision: string | null,
  ): RealtimeWriteResult | Promise<RealtimeWriteResult>;
}
