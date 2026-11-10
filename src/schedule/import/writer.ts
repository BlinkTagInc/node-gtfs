import type { CompiledGtfsTable } from '../../schema/compile-table.ts';
import type { GtfsReportingConfig } from '../../reporting/types.ts';
import { validationNotice } from '../../reporting/report.ts';
import { addValidationNotice, type MutableGtfsImportResult } from './result.ts';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  toGtfsError,
} from '../../diagnostics/errors.ts';
import type { NormalizedImportRowBatch } from './records.ts';
import type { GtfsStoragePlan } from '../../database/storage/plan.ts';
import { getDatabaseErrorContext } from '../../database/error-context.ts';
import {
  formatGtfsSourcePosition,
  type GtfsDiagnosticPosition,
} from '../../diagnostics/position.ts';
import type { GtfsDatabaseDialect } from '../../database/dialects.ts';

export interface GtfsFileWriterOptions {
  readonly table: CompiledGtfsTable;
  readonly filename: string;
  readonly sourceId: string;
  readonly onDuplicateKey: 'reject' | 'keep-first';
  readonly reporting: GtfsReportingConfig;
  readonly result?: MutableGtfsImportResult;
}

interface GtfsBatchWriteResult {
  readonly rowsInserted: number;
  readonly rowsSkipped: number;
}

export interface GtfsFileWriter {
  /**
   * Await each batch before providing another. Writers retain no file-wide keys.
   * The import target owns source atomicity across batches and files; a writer
   * must use the transaction-scoped connection supplied by that target.
   */
  writeBatch(
    batch: NormalizedImportRowBatch,
  ): GtfsBatchWriteResult | Promise<GtfsBatchWriteResult>;
}

/** Shared source/driver context; native writers identify a row, bulk SQL a chunk. */
export function toGtfsWriteError(
  error: unknown,
  options: GtfsFileWriterOptions,
  context: GtfsDiagnosticPosition & {
    readonly databaseDialect: GtfsDatabaseDialect;
    readonly databasePath?: string;
  },
) {
  return toGtfsError(error, {
    message:
      context.position === undefined
        ? `Could not store ${options.filename} insert containing ${context.positions?.length ?? 0} source records`
        : `Could not store ${options.filename} ${formatGtfsSourcePosition(context.position)}`,
    code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
    category: GtfsErrorCategory.DATABASE,
    ...(context.position === undefined ? {} : { position: context.position }),
    ...(context.positions === undefined
      ? {}
      : { positions: context.positions }),
    details: {
      filename: options.filename,
      sourceId: options.sourceId,
      table: options.table.tableName,
      databaseDialect: context.databaseDialect,
      ...getDatabaseErrorContext(error),
      ...(context.databasePath === undefined
        ? {}
        : {
            databasePath: context.databasePath,
            dbCode: (error as { code?: unknown } | null)?.code,
          }),
    },
  });
}

export interface GtfsScheduleWriterOptions<
  Database,
> extends GtfsFileWriterOptions {
  readonly database: Database;
  readonly storagePlan: GtfsStoragePlan;
}

export function reportStoredDuplicateKeys(
  options: GtfsFileWriterOptions,
  skippedRows: number,
): void {
  if (skippedRows === 0) {
    return;
  }

  const notice = {
    code: GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
    severity: 'warn' as const,
    message: `${skippedRows} ${skippedRows === 1 ? 'row' : 'rows'} in ${options.filename} matched primary keys already stored for source ${JSON.stringify(options.sourceId)} and ${skippedRows === 1 ? 'was' : 'were'} skipped`,
    filename: options.filename,
    sourceId: options.sourceId,
    details: {
      table: options.table.tableName,
      fields: options.table.primaryKey,
      skippedRows,
      scope: 'database',
    },
  };

  if (options.result !== undefined) {
    addValidationNotice(options.result, notice);
  }
  validationNotice(options.reporting, notice, 'import');
}
