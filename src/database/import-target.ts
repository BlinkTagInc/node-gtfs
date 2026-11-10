import type {
  GtfsFileWriter,
  GtfsFileWriterOptions,
} from '../schedule/import/writer.ts';
import type {
  GtfsSchemaDatabaseContext,
  GtfsSchemaInspection,
} from './schema-lifecycle.ts';
import type { GtfsStoragePlan } from './storage/plan.ts';

/**
 * Database execution boundary for the single Schedule import workflow.
 * Orchestration prepares/normalizes input, chooses duplicate policy, awaits every
 * batch, and sequences schema setup, source transactions, indexes, and statistics.
 * Targets neither read feeds nor choose when a source replacement commits.
 */
export interface ScheduleImportTarget {
  readonly databaseDescription: string;
  readonly schemaDatabase: GtfsSchemaDatabaseContext;
  readonly errorDetails: Readonly<Record<string, unknown>>;
  readonly storagePlan: GtfsStoragePlan;
  /** Set up/check tables before replacement. DDL is outside source atomicity. */
  initialize(): GtfsSchemaInspection | Promise<GtfsSchemaInspection>;
  /** Bind a file writer to this target's connection and immutable storage plan. */
  createWriter(options: GtfsFileWriterOptions): GtfsFileWriter;
  /** Called inside runSourceTransaction before rechecking or deleting source data. */
  lockSource(sourceId: string): void | Promise<void>;
  invalidateRealtime(sourceId: string): void | Promise<void>;
  findSourceDataTables(options: {
    readonly sourceId: string;
    readonly tableNames: readonly string[];
  }): readonly string[] | Promise<readonly string[]>;
  deleteSourceData(options: {
    readonly sourceId: string;
    readonly tableNames: readonly string[];
  }): void | Promise<void>;
  /**
   * Commit only on callback success; roll back all its writes on failure.
   * Existing transactions use savepoints and remain owned by their caller.
   * All callback work must use the supplied target and settle before returning.
   */
  runSourceTransaction<Result>(
    operation: (target: ScheduleImportTarget) => Promise<Result>,
  ): Promise<Result>;
  /** Create/check indexes after source transactions; never commits source writes. */
  finalize(
    onCreateIndexes?: () => void,
  ): GtfsSchemaInspection | Promise<GtfsSchemaInspection>;
  /** After final validation and a successful source, refresh only planned trips. */
  refreshStatistics(): void | Promise<void>;
  /** Idempotent native SQLite cleanup, called in the workflow's finally block. */
  restoreDurability?(): void;
}
