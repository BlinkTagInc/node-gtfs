import {
  cancellationCheckpoint,
  getOperationSignal,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import type { Kysely } from 'kysely';
import {
  fileBackedTables,
  type FileBackedCompiledGtfsTable,
} from '../../schema/table-registry.ts';
import { createSqliteImportTarget } from '../../database/sqlite/import-target.ts';
import { createKyselyImportTarget } from '../../database/kysely/import-target.ts';
import type { ScheduleImportTarget } from '../../database/import-target.ts';
import {
  createGtfsStoragePlan,
  type GtfsStoragePlan,
} from '../../database/storage/plan.ts';
import { getDatabaseErrorContext } from '../../database/error-context.ts';
import { withDatabaseCleanup } from '../../database/cleanup.ts';
import {
  beginReportingOperation,
  log,
  progress,
  report,
  status,
  validationNotice,
} from '../../reporting/report.ts';
import {
  formatCount,
  formatFileCount,
  redactUrlForReporting,
  pluralize,
} from '../../reporting/format.ts';
import {
  addImportError,
  addValidationNotice,
  createGtfsImportResult,
  createGtfsImportSourceResult,
  finishGtfsImportResult,
  getImportFileResult,
  type GtfsImportResult,
  type MutableGtfsImportResult,
  type MutableGtfsImportSourceResult,
} from './result.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
  toGtfsError,
} from '../../diagnostics/errors.ts';
import {
  stageGtfsSource,
  importGtfsSourceDirectly,
  type StagedGtfsSource,
} from './process-source.ts';
import type {
  GtfsSourceScanProgress,
  GtfsSourceValidationResult,
} from '../../validation/types.ts';
import type {
  GtfsImportSourceOptions,
  GtfsNormalizedBatchSink,
} from './scan.ts';
import type { GtfsFileWriter } from './writer.ts';
import { freezeValidationSummary } from '../../validation/summary.ts';
import { assertCompatibleGtfsSchema } from '../../database/schema-lifecycle.ts';
import type { ResolvedGtfsImportConfig } from '../../config/resolver.ts';
import type { GtfsDatabaseDialect } from '../../database/dialects.ts';
import type { GtfsReportingConfig } from '../../reporting/types.ts';
import {
  filterGtfsTablesByExtensions,
  resolveGtfsExtensions,
  type GtfsExtension,
} from '../../schema/extensions.ts';
import {
  prepareScheduleSource,
  detectScheduleSourceExtensions,
  type PreparedScheduleSource,
  type ScheduleImportSource,
} from './prepare-source.ts';

interface ScheduleImportTask extends PreparedScheduleSource {
  readonly defaultAgencyId?: string;
  readonly reporting: GtfsReportingConfig;
  readonly enabledExtensions: readonly GtfsExtension[];
  readonly enabledFileTables: readonly FileBackedCompiledGtfsTable[];
  readonly result: MutableGtfsImportResult;
  readonly sourceResult: MutableGtfsImportSourceResult;
}

interface ScheduleImportCounts {
  readonly files: number;
  readonly rows: number;
}

type ScheduleImportConfig = Pick<
  ResolvedGtfsImportConfig,
  'sources' | 'reporting' | 'extensions'
> & {
  readonly database: {
    readonly dialect: GtfsDatabaseDialect;
    readonly path?: string;
  };
};

interface ScheduleImportRun {
  readonly config: ScheduleImportConfig;
  readonly databaseDescription: string;
  readonly result: MutableGtfsImportResult;
  readonly preparedSources: Set<PreparedScheduleSource>;
  readonly sources: Map<
    string,
    {
      readonly result: MutableGtfsImportSourceResult;
      startedAt?: bigint;
    }
  >;
}

function getSourceOutcome(run: ScheduleImportRun, sourceId: string) {
  const outcome = run.sources.get(sourceId);
  if (outcome === undefined) {
    throw new Error(`Missing import outcome for source ${sourceId}`);
  }
  return outcome;
}

function finishSourceDuration(run: ScheduleImportRun, sourceId: string): void {
  const outcome = getSourceOutcome(run, sourceId);
  if (outcome.startedAt !== undefined) {
    outcome.result.durationMs =
      Number(process.hrtime.bigint() - outcome.startedAt) / 1_000_000;
  }
}

interface ScheduleImportExtensionResolution {
  readonly enabledExtensions: readonly GtfsExtension[];
  readonly preparedSources: readonly PreparedScheduleSource[];
}

const BATCH_SIZE = 100_000;

function reportMissingScheduleFiles(
  task: ScheduleImportTask,
  files: ReadonlyMap<string, unknown>,
): void {
  const missing = task.enabledFileTables
    .filter(
      (table) =>
        table.specification === 'gtfs-schedule' &&
        !task.source.schedule.excludeFiles.includes(table.filename) &&
        !files.has(table.filename),
    )
    .map((table) => table.filename);
  if (missing.length > 0) {
    status(
      task.reporting,
      `Not in this feed (${missing.length}): ${missing.join(', ')}`,
      { heading: false },
    );
  }
}

function createScheduleImportWriter(
  target: ScheduleImportTarget,
  task: ScheduleImportTask,
  table: FileBackedCompiledGtfsTable,
): GtfsFileWriter {
  const { validation } = task.source.schedule.import;
  const writer = target.createWriter({
    table,
    filename: table.filename,
    sourceId: task.source.sourceId,
    onDuplicateKey: validation.onDuplicateKey,
    reporting: task.reporting,
    result: task.result,
  });
  return {
    async writeBatch(batch) {
      try {
        await cancellationCheckpoint();
        const counts = await writer.writeBatch(batch);
        throwIfOperationAborted();
        const file = getImportFileResult(task.sourceResult, table.filename);
        file.rowsInserted += counts.rowsInserted;
        file.rowsSkipped += counts.rowsSkipped;
        return counts;
      } catch (error: unknown) {
        throw toGtfsError(error, {
          message: `Could not store ${table.filename} rows`,
          code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: {
            filename: table.filename,
            ...target.errorDetails,
            ...getDatabaseErrorContext(error),
          },
        });
      }
    },
  };
}

function createDirectImportSink({
  target,
  task,
}: {
  readonly target: ScheduleImportTarget;
  readonly task: ScheduleImportTask;
}): GtfsNormalizedBatchSink {
  const writers = new Map<string, GtfsFileWriter>();
  const tables = new Map(
    task.enabledFileTables.map((table) => [table.tableName, table]),
  );
  return {
    batchSize: getOperationSignal() === undefined ? BATCH_SIZE : 1000,
    async writeBatch(batch) {
      const table = tables.get(batch.table.tableName);
      if (table === undefined) {
        throw new Error(`No import table for ${batch.table.tableName}`);
      }
      let writer = writers.get(table.tableName);
      if (writer === undefined) {
        writer = createScheduleImportWriter(target, task, table);
        writers.set(table.tableName, writer);
      }
      await writer.writeBatch(batch);
    },
  };
}

function createSourceScanProgressReporter({
  reporting,
  sourceId,
}: {
  readonly reporting: GtfsReportingConfig;
  readonly sourceId: string;
}): (event: GtfsSourceScanProgress) => void {
  const context = {
    operation: 'import' as const,
    sourceId,
    progressBar: false,
  };
  return (event) => {
    if (event.stage === 'references') {
      status(
        reporting,
        event.phase === 'start'
          ? 'Checking references between files'
          : 'Checked references between files',
        { ...context, phase: event.phase },
      );
      return;
    }
    const message = `${event.filename} — ${pluralize('row', 'rows', event.rows)}${event.phase === 'progress' ? ' processed' : ''}`;
    if (event.phase === 'progress') {
      progress(reporting, message, {
        ...context,
        filename: event.filename,
        current: event.rows,
      });
    } else {
      status(reporting, message, {
        ...context,
        filename: event.filename,
        phase: event.phase,
      });
    }
  };
}

async function importScheduleFiles(
  target: ScheduleImportTarget,
  task: ScheduleImportTask,
  staged: StagedGtfsSource,
): Promise<ScheduleImportCounts> {
  const { schedule, sourceId } = task.source;
  let filesImported = 0;
  let rowsImported = 0;

  status(task.reporting, 'Importing GTFS files', { phase: 'start' });

  for (const table of task.enabledFileTables) {
    const filename = table.filename;

    if (schedule.excludeFiles.includes(filename)) {
      continue;
    }

    const file = staged.files.get(filename);
    if (file === undefined) {
      continue;
    }

    const progressContext = {
      operation: 'import' as const,
      sourceId,
      filename,
      total: file.totalRecordCount,
    };
    progress(task.reporting, `Importing ${filename}`, {
      ...progressContext,
      current: 0,
    });

    const writer = createScheduleImportWriter(target, task, table);
    let totalRecordCount = 0;

    try {
      for (const batch of staged.batches(
        table,
        getOperationSignal() === undefined ? BATCH_SIZE : 1000,
        file.totalRecordCount,
      )) {
        await writer.writeBatch(batch);

        totalRecordCount = batch.totalRecordCount;
        if (batch.records.length >= BATCH_SIZE) {
          progress(
            task.reporting,
            formatFileCount(filename, totalRecordCount),
            {
              ...progressContext,
              current: totalRecordCount,
            },
          );
        }
      }
    } catch (error: unknown) {
      throw toGtfsError(error, {
        message: `Could not import staged ${filename} rows`,
        code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
        category: GtfsErrorCategory.DATABASE,
        details: { filename, sourceId, ...getDatabaseErrorContext(error) },
      });
    }

    filesImported += 1;
    rowsImported += getImportFileResult(
      task.sourceResult,
      filename,
    ).rowsInserted;
    status(task.reporting, formatFileCount(filename, totalRecordCount), {
      phase: 'complete',
      operation: 'import',
      sourceId,
      filename,
    });
  }

  reportMissingScheduleFiles(task, staged.files);

  return Object.freeze({ files: filesImported, rows: rowsImported });
}

function reportDisabledExtensionFiles(task: ScheduleImportTask): void {
  const enabled = new Set(task.enabledExtensions);
  const disabledTables = new Map<
    GtfsExtension,
    FileBackedCompiledGtfsTable[]
  >();
  for (const table of fileBackedTables) {
    if (
      table.specification === 'gtfs-schedule' ||
      enabled.has(table.specification) ||
      task.source.schedule.excludeFiles.includes(table.filename) ||
      !existsSync(path.join(task.stagingDirectory, table.filename))
    ) {
      continue;
    }

    const tables = disabledTables.get(table.specification) ?? [];
    tables.push(table);
    disabledTables.set(table.specification, tables);
  }

  for (const [extension, tables] of disabledTables) {
    const filenames = tables.map((table) => table.filename).sort();
    const filename = filenames[0];
    if (filename === undefined) {
      continue;
    }
    const singleFile = filenames.length === 1;
    const notice: GtfsValidationNotice = {
      code: GtfsValidationNoticeCode.EXTENSION_DISABLED,
      severity: 'warn',
      message:
        extension === 'tods-v1'
          ? `${filenames.join(', ')} ${singleFile ? 'uses' : 'use'} TODS v1 and ${singleFile ? 'was' : 'were'} not imported; add "tods-v1" to the \`extensions\` configuration array, without "tods", to import ${singleFile ? 'it' : 'them'}`
          : extension === 'tods' && enabled.has('tods-v1')
            ? `${filenames.join(', ')} ${singleFile ? 'uses' : 'use'} current TODS and ${singleFile ? 'was' : 'were'} not imported; use a separate database with "tods" in the \`extensions\` configuration array, without "tods-v1", to import ${singleFile ? 'it' : 'them'}`
            : `${filenames.join(', ')} ${singleFile ? 'is' : 'are'} part of the ${JSON.stringify(extension)} GTFS extension and ${singleFile ? 'was' : 'were'} not imported; add ${JSON.stringify(extension)} to the \`extensions\` array in configuration to import ${singleFile ? 'it' : 'them'}`,
      filename,
      sourceId: task.source.sourceId,
      details: {
        filenames,
        tables: tables.map((table) => table.tableName).sort(),
        extension,
        enabledExtensions: [...task.enabledExtensions],
      },
    };
    addValidationNotice(task.result, notice);
    validationNotice(task.reporting, notice, 'import');
  }
}

function createScheduleImportTask(options: {
  run: ScheduleImportRun;
  preparedSource: PreparedScheduleSource;
  enabledExtensions: readonly GtfsExtension[];
  enabledFileTables: readonly FileBackedCompiledGtfsTable[];
}): ScheduleImportTask {
  const { run, preparedSource, enabledExtensions, enabledFileTables } = options;
  const { source } = preparedSource;
  return Object.freeze({
    ...preparedSource,
    ...(source.schedule.defaultAgencyId === undefined
      ? {}
      : { defaultAgencyId: source.schedule.defaultAgencyId }),
    reporting: run.config.reporting,
    enabledExtensions,
    enabledFileTables,
    result: run.result,
    sourceResult: getSourceOutcome(run, source.sourceId).result,
  });
}

async function prepareImportSource(
  run: ScheduleImportRun,
  source: ScheduleImportSource,
): Promise<PreparedScheduleSource> {
  getSourceOutcome(run, source.sourceId).startedAt ??= process.hrtime.bigint();
  const preparedSource = await prepareScheduleSource({
    source,
    reporting: run.config.reporting,
    databaseDescription: run.databaseDescription,
  });
  run.preparedSources.add(preparedSource);
  return preparedSource;
}

function handleScheduleSourceError(
  run: ScheduleImportRun,
  source: ScheduleImportSource,
  error: unknown,
): void {
  const schedule = source.schedule;
  const wrappedError = toGtfsError(error, {
    message: !('path' in schedule)
      ? `Could not prepare GTFS Schedule source ${JSON.stringify(source.sourceId)}`
      : `Could not read GTFS Schedule source ${JSON.stringify(source.sourceId)}`,
    code: !('path' in schedule)
      ? GtfsErrorCode.DOWNLOAD_FAILED
      : GtfsErrorCode.SOURCE_READ_FAILED,
    category: !('path' in schedule)
      ? GtfsErrorCategory.DOWNLOAD
      : GtfsErrorCategory.SOURCE,
    details:
      'path' in schedule
        ? { sourcePath: schedule.path }
        : {
            sourceUrl: redactUrlForReporting(schedule.url),
          },
  });
  const sourceResult = getSourceOutcome(run, source.sourceId).result;
  sourceResult.error = wrappedError;
  sourceResult.success = false;
  // Source writes are provisional until its replacement transaction commits.
  for (const file of sourceResult.files) {
    file.rowsInserted = 0;
  }
  finishSourceDuration(run, source.sourceId);
  if (
    wrappedError.code === GtfsErrorCode.OPERATION_CANCELLED ||
    wrappedError.details?.databaseRecoveryRequired === true ||
    schedule.import.onSourceError !== 'continue'
  ) {
    throw wrappedError;
  }

  log(run.config.reporting, 'error', wrappedError, {
    sourceId: source.sourceId,
  });
  addImportError(run.result, wrappedError);
}

async function resolveScheduleImportExtensions(
  run: ScheduleImportRun,
): Promise<ScheduleImportExtensionResolution> {
  const autoDetect = run.config.extensions === 'auto';
  if (!autoDetect) {
    return Object.freeze({
      enabledExtensions: resolveGtfsExtensions(run.config.extensions),
      preparedSources: Object.freeze([]),
    });
  }

  const preparedSources: PreparedScheduleSource[] = [];
  for (const source of run.config.sources) {
    try {
      preparedSources.push(await prepareImportSource(run, source));
    } catch (error: unknown) {
      handleScheduleSourceError(run, source, error);
    }
  }

  return Object.freeze({
    enabledExtensions: detectScheduleSourceExtensions(preparedSources),
    preparedSources: Object.freeze(preparedSources),
  });
}

function applySourceValidationResult(
  task: ScheduleImportTask,
  validationResult: GtfsSourceValidationResult,
): void {
  const { sourceId } = task.source;
  if (!validationResult.shouldReject) {
    return;
  }

  throw new GtfsError(
    `GTFS validation failed for source ${JSON.stringify(sourceId)} with ${pluralize('error', 'errors', validationResult.countsBySeverity.error)}`,
    {
      code: GtfsErrorCode.VALIDATION_FAILED,
      category: GtfsErrorCategory.VALIDATION,
      details: { validation: freezeValidationSummary(validationResult) },
    },
  );
}

function reportScheduleDefaultAgencyId(
  task: ScheduleImportTask,
  defaultAgencyId: string | undefined,
): void {
  if (
    task.defaultAgencyId !== undefined &&
    defaultAgencyId !== task.defaultAgencyId
  ) {
    log(
      task.reporting,
      'warn',
      `\`sources[].schedule.defaultAgencyId\` differs from agency.txt; using agency_id ${JSON.stringify(defaultAgencyId)}`,
    );
  }
}

async function checkExistingSourceDataPolicy(
  target: ScheduleImportTarget,
  task: ScheduleImportTask,
): Promise<readonly string[]> {
  const tableNames = task.enabledFileTables.map((table) => table.tableName);
  const existingTableNames = await target.findSourceDataTables({
    sourceId: task.source.sourceId,
    tableNames,
  });
  if (existingTableNames.length === 0) {
    return [];
  }

  if (task.source.schedule.import.onExistingData === 'reject') {
    throw new GtfsError(
      `Schedule data already exists for source ${JSON.stringify(task.source.sourceId)}; set the \`sources[].schedule.import.onExistingData\` configuration option to "replace-source" to replace it`,
      {
        code: GtfsErrorCode.DATABASE_SOURCE_EXISTS,
        category: GtfsErrorCategory.DATABASE,
        details: {
          sourceId: task.source.sourceId,
          onExistingData: task.source.schedule.import.onExistingData,
          tables: existingTableNames,
        },
      },
    );
  }

  return tableNames;
}

async function replaceScheduleSource(
  target: ScheduleImportTarget,
  task: ScheduleImportTask,
  operation: (target: ScheduleImportTarget) => Promise<ScheduleImportCounts>,
): Promise<ScheduleImportCounts> {
  return target.runSourceTransaction(async (transactionalTarget) => {
    const { sourceId } = task.source;
    await cancellationCheckpoint();
    await transactionalTarget.lockSource(sourceId);
    // Preparation can take time; recheck against the transaction's current data.
    const tableNames = await checkExistingSourceDataPolicy(
      transactionalTarget,
      task,
    );
    await transactionalTarget.invalidateRealtime(sourceId);
    if (tableNames.length > 0) {
      const sourceDescription =
        sourceId === 'default' ? '' : ` for source ${JSON.stringify(sourceId)}`;
      const deletionContext = {
        operation: 'import' as const,
        sourceId,
        progressBar: false,
      };
      status(
        task.reporting,
        `Deleting existing schedule data${sourceDescription}`,
        {
          ...deletionContext,
          phase: 'start',
          heading: true,
        },
      );
      await transactionalTarget.deleteSourceData({ sourceId, tableNames });
      status(
        task.reporting,
        `Deleted existing schedule data${sourceDescription}`,
        {
          ...deletionContext,
          phase: 'complete',
        },
      );
    }
    const result = await operation(transactionalTarget);
    await cancellationCheckpoint();
    return result;
  });
}

async function importPreparedScheduleSource(
  target: ScheduleImportTarget,
  task: ScheduleImportTask,
): Promise<ScheduleImportCounts> {
  const { schedule, sourceId } = task.source;
  const validationEnabled = schedule.import.validation.mode !== 'off';
  const useDirectImport =
    !validationEnabled &&
    target.storagePlan.dialect === 'sqlite' &&
    schedule.import.validation.onUnknownField === 'preserve' &&
    schedule.import.validation.onDuplicateKey === 'reject';
  if (!validationEnabled) {
    status(
      task.reporting,
      'Validation off; set the `sources[].schedule.import.validation.mode` configuration option to "strict" to enable it',
      { sourceId, operation: 'import' },
    );
  }
  reportDisabledExtensionFiles(task);
  const replacementTables = await checkExistingSourceDataPolicy(target, task);
  if (replacementTables.length > 0) {
    status(
      task.reporting,
      sourceId === 'default'
        ? 'Existing schedule data will be replaced'
        : `Existing schedule data for source ${JSON.stringify(sourceId)} will be replaced`,
      { heading: false, operation: 'import', sourceId },
    );
  }
  if (!useDirectImport) {
    status(
      task.reporting,
      validationEnabled ? 'Validating GTFS files' : 'Preparing GTFS files',
      { phase: 'start' },
    );
  }
  const scanOptions: GtfsImportSourceOptions = {
    directory: task.stagingDirectory,
    tables: task.enabledFileTables,
    csv: schedule.import.csv,
    excludeFiles: schedule.excludeFiles,
    ...schedule.import.validation,
    sourceId,
    onNotice(notice) {
      addValidationNotice(task.result, notice);
      validationNotice(task.reporting, notice, 'import');
    },
    onFileRead({ filename, recordsRead, rowsSkipped }) {
      const file = getImportFileResult(task.sourceResult, filename);
      file.recordsRead = recordsRead;
      file.rowsSkipped += rowsSkipped;
    },
    onProgress: createSourceScanProgressReporter({
      reporting: task.reporting,
      sourceId,
    }),
    ...(task.defaultAgencyId === undefined
      ? {}
      : { defaultAgencyId: task.defaultAgencyId }),
  };
  if (useDirectImport) {
    return replaceScheduleSource(target, task, async (transactionalTarget) => {
      status(task.reporting, 'Importing GTFS files', { phase: 'start' });
      const imported = await importGtfsSourceDirectly({
        options: {
          ...scanOptions,
          mode: 'off',
          onUnknownField: 'preserve',
          onDuplicateKey: 'reject',
        },
        sink: createDirectImportSink({ target: transactionalTarget, task }),
      });
      applySourceValidationResult(task, imported.validation);
      reportScheduleDefaultAgencyId(task, imported.defaultAgencyId);
      reportMissingScheduleFiles(task, imported.files);
      return Object.freeze({
        files: imported.files.size,
        rows: task.sourceResult.files.reduce(
          (sum, file) => sum + file.rowsInserted,
          0,
        ),
      });
    });
  }
  const staged = await stageGtfsSource(scanOptions);
  return withDatabaseCleanup(
    async () => {
      applySourceValidationResult(task, staged.validation);
      staged.assertNormalized();
      reportScheduleDefaultAgencyId(task, staged.defaultAgencyId);
      return await replaceScheduleSource(target, task, (transactionalTarget) =>
        importScheduleFiles(transactionalTarget, task, staged),
      );
    },
    async () => {
      await staged.close();
    },
  );
}

async function importScheduleSources(options: {
  run: ScheduleImportRun;
  target: ScheduleImportTarget;
  enabledExtensions: readonly GtfsExtension[];
  enabledFileTables: readonly FileBackedCompiledGtfsTable[];
  preparedSources: readonly PreparedScheduleSource[];
}): Promise<ScheduleImportCounts> {
  const { run, target, enabledExtensions, enabledFileTables, preparedSources } =
    options;
  const preparedBySource = new Map(
    preparedSources.map((preparedSource) => [
      preparedSource.source,
      preparedSource,
    ]),
  );
  let filesImported = 0;
  let rowsImported = 0;

  for (const source of run.config.sources) {
    let preparedSource = preparedBySource.get(source);
    if (preparedSource === undefined && run.config.extensions === 'auto') {
      // A source that failed during auto-detection has already been reported.
      continue;
    }

    try {
      await withDatabaseCleanup(
        async () => {
          preparedSource ??= await prepareImportSource(run, source);
          const task = createScheduleImportTask({
            run,
            preparedSource,
            enabledExtensions,
            enabledFileTables,
          });
          const imported = await importPreparedScheduleSource(target, task);
          task.sourceResult.success = true;
          filesImported += imported.files;
          rowsImported += imported.rows;
        },
        async () => {
          try {
            if (preparedSource !== undefined) {
              await preparedSource.cleanup();
              run.preparedSources.delete(preparedSource);
            }
          } finally {
            finishSourceDuration(run, source.sourceId);
          }
        },
      );
    } catch (error: unknown) {
      handleScheduleSourceError(run, source, error);
    }
  }

  return Object.freeze({ files: filesImported, rows: rowsImported });
}

async function initializeScheduleImportTarget(
  config: ScheduleImportConfig,
  target: ScheduleImportTarget,
): Promise<void> {
  report(config.reporting, {
    type: 'operation:start',
    operation: 'import',
    sourceCount: config.sources.length,
    sourceIds: config.sources.map((source) => source.sourceId),
    databaseDescription: target.databaseDescription,
  });

  throwIfOperationAborted();
  await assertCompatibleGtfsSchema(
    await target.initialize(),
    target.schemaDatabase,
  );
}

function toScheduleImportError(options: {
  readonly config: ScheduleImportConfig;
  readonly target: ScheduleImportTarget | undefined;
  readonly sqliteTarget: boolean;
  readonly error: unknown;
}): GtfsError {
  const { config, target, sqliteTarget, error } = options;
  const databasePath = config.database.path ?? ':memory:';
  if (
    sqliteTarget &&
    (error as { code?: string } | null | undefined)?.code === 'SQLITE_CANTOPEN'
  ) {
    return new GtfsError(
      `Could not open SQLite database ${JSON.stringify(databasePath)}; ensure its parent directory exists and is writable`,
      {
        code: GtfsErrorCode.DATABASE_OPEN_FAILED,
        category: GtfsErrorCategory.DATABASE,
        details: {
          path: databasePath,
          dbCode: 'SQLITE_CANTOPEN',
        },
        cause: error,
      },
    );
  }

  return toGtfsError(error, {
    message: 'Could not import GTFS Schedule data',
    code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
    category: GtfsErrorCategory.DATABASE,
    details: {
      ...(target?.errorDetails ?? { path: databasePath }),
      ...getDatabaseErrorContext(error),
    },
  });
}

async function runScheduleImport(options: {
  readonly config: ScheduleImportConfig;
  readonly databaseDescription: string;
  readonly targetFactory: (
    storagePlan: GtfsStoragePlan,
  ) => ScheduleImportTarget;
  readonly sqliteTarget: boolean;
}): Promise<GtfsImportResult> {
  const { config, targetFactory, sqliteTarget } = options;
  beginReportingOperation(config.reporting);
  const startTime = process.hrtime.bigint();
  let targetForError: ScheduleImportTarget | undefined;
  const run: ScheduleImportRun = {
    config,
    databaseDescription: options.databaseDescription,
    result: createGtfsImportResult(),
    preparedSources: new Set(),
    sources: new Map(),
  };
  for (const source of config.sources) {
    const result = createGtfsImportSourceResult(source.sourceId);
    run.result.sources.push(result);
    run.sources.set(source.sourceId, { result });
  }

  const createTarget = (extensions: readonly GtfsExtension[]) =>
    targetFactory(
      createGtfsStoragePlan({
        dialect: config.database.dialect,
        mode: 'ensure',
        extensions,
      }),
    );

  try {
    const counts = await withDatabaseCleanup(
      async () => {
        if (config.extensions === 'auto') {
          const preflightTarget = createTarget([]);
          targetForError = preflightTarget;
          await withDatabaseCleanup(
            async () => {
              await assertCompatibleGtfsSchema(
                await preflightTarget.initialize(),
                preflightTarget.schemaDatabase,
              );
            },
            () => {
              preflightTarget.restoreDurability?.();
            },
          );
        }

        const extensionResolution = await resolveScheduleImportExtensions(run);
        const { enabledExtensions, preparedSources } = extensionResolution;
        const enabledFileTables = filterGtfsTablesByExtensions(
          fileBackedTables,
          enabledExtensions,
        );

        const target = createTarget(enabledExtensions);
        targetForError = target;
        await initializeScheduleImportTarget(config, target);

        const counts = await importScheduleSources({
          run,
          target,
          enabledExtensions,
          enabledFileTables,
          preparedSources,
        });

        await cancellationCheckpoint();
        const finalSchema = await target.finalize(() => {
          status(config.reporting, 'Creating database indexes', {
            phase: 'start',
          });
          throwIfOperationAborted();
        });
        throwIfOperationAborted();
        await assertCompatibleGtfsSchema(finalSchema, target.schemaDatabase);
        if (run.result.sources.some(({ success }) => success)) {
          await target.refreshStatistics();
        }
        return counts;
      },
      () =>
        withDatabaseCleanup(
          async () => {
            targetForError?.restoreDurability?.();
          },
          async () => {
            await Promise.all(
              [...run.preparedSources].map((source) => source.cleanup()),
            );
          },
        ),
    );

    report(config.reporting, {
      type: 'operation:complete',
      operation: 'import',
      durationMs: Number((process.hrtime.bigint() - startTime) / 1_000_000n),
      databaseDescription: run.databaseDescription,
      summary: `${pluralize('file', 'files', counts.files)}, ${formatCount(counts.rows)} rows`,
    });
  } catch (error: unknown) {
    const wrappedError = toScheduleImportError({
      config,
      target: targetForError,
      sqliteTarget,
      error,
    });
    if (wrappedError.code === GtfsErrorCode.DATABASE_OPEN_FAILED) {
      log(config.reporting, 'error', wrappedError);
    }
    throw wrappedError;
  }

  return finishGtfsImportResult(
    run.result,
    Number(process.hrtime.bigint() - startTime) / 1_000_000,
  );
}

type GtfsImportConnection<DB> =
  | {
      readonly database: Kysely<DB>;
      readonly sqlite?: never;
    }
  | {
      readonly database?: never;
      readonly sqlite: Database.Database;
    };

/** Runs a resolved Schedule import on an already-open, caller-owned connection. */
export function importGtfsOnConnection<DB>(
  resolved: ResolvedGtfsImportConfig<DB>,
  connection: GtfsImportConnection<DB>,
): Promise<GtfsImportResult> {
  if (connection.sqlite !== undefined) {
    return runScheduleImport({
      config: resolved,
      databaseDescription: `sqlite3 database at ${connection.sqlite.name}`,
      targetFactory: (storagePlan) =>
        createSqliteImportTarget({
          database: connection.sqlite,
          storagePlan,
          ...('path' in resolved.database &&
          resolved.database.path !== undefined
            ? { databasePath: resolved.database.path }
            : {}),
          ...('durability' in resolved.database &&
          resolved.database.durability !== undefined
            ? { durability: resolved.database.durability }
            : {}),
        }),
      sqliteTarget: true,
    });
  }
  return runScheduleImport({
    config: resolved,
    databaseDescription: `Kysely ${resolved.database.dialect} database`,
    targetFactory: (storagePlan) =>
      createKyselyImportTarget({ database: connection.database, storagePlan }),
    sqliteTarget: false,
  });
}
