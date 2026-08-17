import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { cp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';

import {
  getGtfsIndexPlan,
  getTimestampColumnName,
} from '../schema/compile-table.ts';
import { compiledTables, fileBackedTables } from '../schema/table-registry.ts';
import { openDb } from './db.ts';
import { temporaryDirectory, untildify, unzip } from './file-utils.ts';
import { parseGtfsFile } from './gtfs-record-parser.ts';
import type { GtfsFileWriter, GtfsFileWriterOptions } from './gtfs-writer.ts';
import {
  createKyselyGtfsIndexes,
  createKyselyGtfsTables,
  createKyselyGtfsWriter,
  type KyselyImportOptions,
} from './kysely-gtfs-writer.ts';
import { createSqliteGtfsWriter } from './sqlite-gtfs-writer.ts';
import { updateGtfsRealtimeData } from './import-gtfs-realtime.ts';
import { log, progress, report, status } from '../reporting/report.ts';
import {
  formatBytes,
  formatCount,
  formatFileCount,
  formatFileList,
  formatFileNote,
  formatUrl,
  pluralize,
} from '../reporting/format.ts';
import { validateConfig } from './validate-config.ts';
import { applyConfigDefaults, escapeIdentifier, mapSeries } from './utils.ts';
import {
  addImportError,
  createImportReport,
  formatGtfsError,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  ImportReport,
  isGtfsError,
  toGtfsError,
} from './errors.ts';

import {
  type GtfsFeedConfig,
  type GtfsImportConfig,
  type GtfsSqliteImportConfig,
} from '../types/config.ts';
import type { ReportingOptions } from '../reporting/types.ts';
import type { GtfsFileBackedTableName } from '../schema/database.ts';

interface GtfsImportTask {
  exclude?: readonly GtfsFileBackedTableName[];
  url?: string;
  headers?: Readonly<Record<string, string>>;
  realtimeAlerts?: {
    url: string;
    headers?: Readonly<Record<string, string>>;
  };
  realtimeTripUpdates?: {
    url: string;
    headers?: Readonly<Record<string, string>>;
  };
  realtimeVehiclePositions?: {
    url: string;
    headers?: Readonly<Record<string, string>>;
  };
  downloadDir: string;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  path?: string;
  csvOptions: object;
  ignoreDuplicates: boolean;
  ignoreErrors: boolean;
  prefix?: string;
  fillEmptyAgencyId: boolean;
  agencyId?: string;
  currentTimestamp: number;
  config: ReportingOptions;
  filesImported?: number;
  rowsImported?: number;
  report?: ImportReport;
}

interface StaticImportTarget {
  databaseDescription: string;
  errorDetails: Record<string, unknown>;
  initialize(): void | Promise<void>;
  createWriter(options: GtfsFileWriterOptions): GtfsFileWriter;
  finalize(): void | Promise<void>;
  updateRealtime(task: GtfsImportTask): void | Promise<void>;
}

const STATIC_IMPORT_DEFAULTS = {
  ignoreDuplicates: false,
  ignoreErrors: false,
  gtfsRealtimeExpirationSeconds: 0,
  downloadTimeout: 30000,
} as const;

type ResolvedImportConfig<Config extends GtfsImportConfig> = ReturnType<
  typeof applyConfigDefaults<Config, typeof STATIC_IMPORT_DEFAULTS>
>;

function reportTaskError(task: GtfsImportTask, error: GtfsError): void {
  if (task.report) {
    addImportError(task.report, error);
  }
}

const getTextFiles = async (folderPath: string): Promise<string[]> => {
  const files = await readdir(folderPath);
  return files.filter((filename) => filename.slice(-3) === 'txt');
};

const downloadGtfsFiles = async (task: GtfsImportTask): Promise<void> => {
  if (!task.url) {
    throw new GtfsError('No `url` specified in config', {
      code: GtfsErrorCode.GTFS_CONFIG_INVALID,
      category: GtfsErrorCategory.CONFIG,
    });
  }

  status(task.config, `Downloading GTFS from ${formatUrl(task.url)}`);

  const downloadStart = process.hrtime.bigint();

  task.path = `${task.downloadDir}/gtfs.zip`;

  try {
    const response = await fetch(task.url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'node-gtfs',
        ...task.headers,
      },
      signal: task.downloadTimeout
        ? AbortSignal.timeout(task.downloadTimeout)
        : undefined,
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new GtfsError(
        `Unable to download GTFS from ${task.url}. Got status ${response.status}.`,
        {
          code: GtfsErrorCode.GTFS_DOWNLOAD_HTTP,
          category: GtfsErrorCategory.DOWNLOAD,
          statusCode: response.status,
          details: {
            url: task.url,
            status: response.status,
            statusText: response.statusText,
          },
        },
      );
    }

    const buffer = await response.arrayBuffer();
    await writeFile(task.path, Buffer.from(buffer));
    status(
      task.config,
      `Downloaded ${formatBytes(buffer.byteLength)} in ${(Number(process.hrtime.bigint() - downloadStart) / 1_000_000_000).toFixed(1)} seconds`,
    );
  } catch (error: unknown) {
    throw toGtfsError(error, {
      message: `Unable to download GTFS from ${task.url}.`,
      code: GtfsErrorCode.GTFS_DOWNLOAD_FAILED,
      category: GtfsErrorCategory.DOWNLOAD,
      details: { url: task.url },
    });
  }
};

const extractGtfsFiles = async (task: GtfsImportTask): Promise<void> => {
  if (!task.path) {
    throw new GtfsError('No `path` specified in config', {
      code: GtfsErrorCode.GTFS_CONFIG_INVALID,
      category: GtfsErrorCategory.CONFIG,
      details: { field: 'path' },
    });
  }

  const gtfsPath = untildify(task.path);
  if (!task.url) {
    status(task.config, `Importing static GTFS from ${task.path}`);
  }
  if (path.extname(gtfsPath) === '.zip') {
    try {
      await unzip(gtfsPath, task.downloadDir);
      const textFiles = await getTextFiles(task.downloadDir);

      // If no .txt files in this directory, check for subdirectories and copy them here
      if (textFiles.length === 0) {
        const files = await readdir(task.downloadDir);
        // Ignore system directories within zip file
        const folders = files
          .filter((filename) => !['__MACOSX'].includes(filename))
          .map((filename) => path.join(task.downloadDir, filename))
          .filter((source) => lstatSync(source).isDirectory());

        if (folders.length > 1) {
          throw new GtfsError(
            `More than one subfolder found in zip file at \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
            {
              code: GtfsErrorCode.GTFS_ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { path: task.path, folderCount: folders.length },
            },
          );
        } else if (folders.length === 0) {
          throw new GtfsError(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
            {
              code: GtfsErrorCode.GTFS_ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { path: task.path },
            },
          );
        }

        const subfolderName = folders[0];
        const directoryTextFiles = await getTextFiles(subfolderName);

        if (directoryTextFiles.length === 0) {
          throw new GtfsError(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
            {
              code: GtfsErrorCode.GTFS_ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { path: task.path, subfolderName },
            },
          );
        }

        await Promise.all(
          directoryTextFiles.map(async (fileName) =>
            rename(
              path.join(subfolderName, fileName),
              path.join(task.downloadDir, fileName),
            ),
          ),
        );
      }
    } catch (error: unknown) {
      const wrappedError = toGtfsError(error, {
        message: `Unable to unzip file ${task.path}`,
        code: GtfsErrorCode.GTFS_ZIP_INVALID,
        category: GtfsErrorCategory.ZIP,
        details: { path: task.path },
      });
      log(task.config, 'error', formatGtfsError(wrappedError));
      throw wrappedError;
    }
  } else {
    // Local file is unzipped, just copy it from there.
    try {
      await cp(gtfsPath, task.downloadDir, { recursive: true });
    } catch (error: unknown) {
      throw new GtfsError(
        `Unable to load files from path \`${gtfsPath}\` defined in configuration. Verify that path exists and contains GTFS files.`,
        {
          code: GtfsErrorCode.GTFS_DOWNLOAD_FAILED,
          category: GtfsErrorCategory.DOWNLOAD,
          details: { path: gtfsPath },
          cause: error,
        },
      );
    }
  }
};

/**
 * Reads agency.txt from disk after extraction to find the single agency_id for a feed.
 * Returns the raw agency_id string if there is exactly one agency with a non-empty
 * agency_id, or undefined otherwise.
 */
const getSingleAgencyId = (
  downloadDir: string,
  csvOptions: object,
  config: ReportingOptions,
): Promise<string | undefined> =>
  new Promise((resolve) => {
    const filepath = path.join(downloadDir, 'agency.txt');

    if (!existsSync(filepath)) {
      resolve(undefined);
      return;
    }

    const rows: Record<string, string>[] = [];
    const parser = parse({
      columns: true,
      relax_quotes: true,
      trim: true,
      skip_empty_lines: true,
      bom: true,
      ...csvOptions,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read())) {
        rows.push(record);
      }
    });

    parser.on('end', () => {
      if (rows.length !== 1) {
        resolve(undefined);
        return;
      }
      const agencyId = rows[0].agency_id?.trim() || undefined;
      resolve(agencyId);
    });

    parser.on('error', (err: Error) => {
      log(
        config,
        'warning',
        `Unable to parse agency.txt for \`fillEmptyAgencyId\`: ${err.message}`,
      );
      resolve(undefined);
    });

    createReadStream(filepath).pipe(parser);
  });

const createGtfsTables = (db: Database.Database): void => {
  for (const table of compiledTables) {
    const sqlColumnCreateStatements = [];

    for (const column of table.columns) {
      const columnName = escapeIdentifier(column.name);
      const checks = [];
      if (column.sqlMinimum !== undefined && column.sqlMaximum !== undefined) {
        checks.push(
          `${columnName} >= ${column.sqlMinimum} AND ${columnName} <= ${column.sqlMaximum}`,
        );
      } else if (column.sqlMinimum !== undefined) {
        checks.push(`${columnName} >= ${column.sqlMinimum}`);
      } else if (column.sqlMaximum !== undefined) {
        checks.push(`${columnName} <= ${column.sqlMaximum}`);
      }

      if (column.storageKind === 'integer') {
        checks.push(
          `(TYPEOF(${columnName}) = 'integer' OR ${columnName} IS NULL)`,
        );
      } else if (column.storageKind === 'real') {
        checks.push(
          `(TYPEOF(${columnName}) = 'real' OR ${columnName} IS NULL)`,
        );
      }

      const required = column.presence === 'required' ? 'NOT NULL' : '';
      const defaultValue =
        column.defaultValue === null
          ? 'NULL'
          : typeof column.defaultValue === 'string'
            ? `'${column.defaultValue.replaceAll("'", "''")}'`
            : String(column.defaultValue);
      const columnDefault =
        column.defaultValue === undefined ? '' : `DEFAULT ${defaultValue}`;
      const columnCollation = column.caseInsensitiveComparison
        ? 'COLLATE NOCASE'
        : '';
      const checkClause =
        checks.length > 0 ? `CHECK(${checks.join(' AND ')})` : '';

      sqlColumnCreateStatements.push(
        `${columnName} ${column.storageKind} ${checkClause} ${required} ${columnDefault} ${columnCollation}`,
      );

      // Add an additional timestamp column for time columns
      if (column.storageKind === 'time') {
        sqlColumnCreateStatements.push(
          `${escapeIdentifier(getTimestampColumnName(column.name))} INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN ${columnName} IS NULL OR ${columnName} = '' THEN NULL
              ELSE CAST(
                substr(${columnName}, 1, instr(${columnName}, ':') - 1) * 3600 +
                substr(${columnName}, instr(${columnName}, ':') + 1, 2) * 60 +
                substr(${columnName}, -2) AS INTEGER
              )
            END
          ) STORED`,
        );
      }
    }

    // Find Primary Key fields
    const primaryColumns = table.columns.filter((column) => column.primaryKey);

    if (primaryColumns.length > 0) {
      sqlColumnCreateStatements.push(
        `PRIMARY KEY (${primaryColumns
          .map(({ name }) => escapeIdentifier(name))
          .join(', ')})`,
      );
    }

    const tableName = escapeIdentifier(table.name);
    db.prepare(`DROP TABLE IF EXISTS ${tableName};`).run();

    db.prepare(
      `CREATE TABLE ${tableName} (${sqlColumnCreateStatements.join(', ')});`,
    ).run();
  }
};

// For columns that are mostly empty, use a partial index (`WHERE column IS NOT NULL`) instead of a full index.
const SPARSE_COLUMN_MAX_DENSITY = 0.1;

const createGtfsIndex = (
  db: Database.Database,
  tableName: string,
  columnName: string,
  partial: boolean,
): void => {
  const escapedTableName = escapeIdentifier(tableName);
  const escapedColumnName = escapeIdentifier(columnName);
  const indexName = escapeIdentifier(`idx_${tableName}_${columnName}`);
  const predicate = partial ? ` WHERE ${escapedColumnName} IS NOT NULL` : '';
  db.prepare(
    `CREATE INDEX ${indexName} ON ${escapedTableName} (${escapedColumnName})${predicate};`,
  ).run();
};

const createGtfsCompositeIndex = (
  db: Database.Database,
  tableName: string,
  columns: string[],
): void => {
  const indexName = escapeIdentifier(`idx_${tableName}_${columns.join('_')}`);
  db.prepare(
    `CREATE INDEX ${indexName} ON ${escapeIdentifier(tableName)} (${columns
      .map((columnName) => escapeIdentifier(columnName))
      .join(', ')});`,
  ).run();
};

const createGtfsIndexes = (db: Database.Database): void => {
  for (const table of compiledTables) {
    const { singleColumnIndexes, compositeIndexes } = getGtfsIndexPlan(table, {
      includeGeneratedTimeIndexes: true,
    });

    if (singleColumnIndexes.length > 0) {
      const columnNames = singleColumnIndexes;
      const { rowCount } = db
        .prepare(
          `SELECT COUNT(*) AS rowCount FROM ${escapeIdentifier(table.name)}`,
        )
        .get() as { rowCount: number };

      if (rowCount === 0) {
        for (const columnName of columnNames) {
          createGtfsIndex(db, table.name, columnName, false);
        }
      } else {
        const counts = db
          .prepare(
            `SELECT ${columnNames
              .map(
                (columnName, index) =>
                  `COUNT(${escapeIdentifier(columnName)}) AS ${escapeIdentifier(`c${index}`)}`,
              )
              .join(', ')} FROM ${escapeIdentifier(table.name)}`,
          )
          .get() as Record<string, number>;

        for (const [index, columnName] of columnNames.entries()) {
          const density = counts[`c${index}`] / rowCount;
          createGtfsIndex(
            db,
            table.name,
            columnName,
            density <= SPARSE_COLUMN_MAX_DENSITY,
          );
        }
      }
    }

    for (const columns of compositeIndexes) {
      createGtfsCompositeIndex(db, table.name, columns);
    }
  }
};

function createSqliteImportTarget(
  db: Database.Database,
  config: GtfsSqliteImportConfig,
): StaticImportTarget {
  const sqlitePath = config.sqlitePath ?? ':memory:';

  return {
    databaseDescription: `SQLite database at ${sqlitePath}`,
    errorDetails: { sqlitePath },
    initialize() {
      createGtfsTables(db);
    },
    createWriter(options) {
      return createSqliteGtfsWriter({ db, sqlitePath, ...options });
    },
    finalize() {
      createGtfsIndexes(db);
    },
    async updateRealtime(task) {
      await updateGtfsRealtimeData({
        ...task,
        sqlitePath: config.sqlitePath ?? ':memory:',
      });
    },
  };
}

function hasRealtimeSource(task: GtfsImportTask): boolean {
  return Boolean(
    task.realtimeAlerts ||
    task.realtimeTripUpdates ||
    task.realtimeVehiclePositions,
  );
}

function createKyselyImportTarget<DB>(
  options: KyselyImportOptions<DB>,
): StaticImportTarget {
  const manageSchema = options.manageSchema ?? true;

  return {
    databaseDescription: `Kysely ${options.dialect} database`,
    errorDetails: { databaseDialect: options.dialect },
    async initialize() {
      if (manageSchema) {
        await createKyselyGtfsTables(options);
      }
    },
    createWriter(writerOptions) {
      return createKyselyGtfsWriter(options, writerOptions);
    },
    async finalize() {
      if (manageSchema) {
        await createKyselyGtfsIndexes(options);
      }
    },
    updateRealtime(task) {
      if (hasRealtimeSource(task)) {
        log(
          task.config,
          'warning',
          'GTFS-Realtime sources are not yet supported by `importGtfsToKysely` and were skipped.',
        );
      }
    },
  };
}

const BATCH_SIZE = 100_000;

const importGtfsFiles = async (
  target: StaticImportTarget,
  task: GtfsImportTask,
): Promise<void> => {
  const missing: string[] = [];
  let filesImported = 0;
  let rowsImported = 0;

  status(task.config, 'Imported');

  await mapSeries(fileBackedTables, async (table) => {
    const filename = table.file;

    if (task.exclude?.some((tableName) => tableName === table.name)) {
      status(task.config, formatFileNote(filename, 'skipped'));
      return;
    }

    const filepath = path.join(task.downloadDir, filename);
    if (!existsSync(filepath)) {
      if (table.namespace === 'gtfs-schedule') {
        missing.push(filename);
      }
      return;
    }

    progress(task.config, `  ${filename}`);

    const writer = target.createWriter({
      table,
      filename,
      ignoreDuplicates: task.ignoreDuplicates,
      prefix: task.prefix,
      config: task.config,
      report: task.report,
    });
    let totalRowCount = 0;

    try {
      for await (const batch of parseGtfsFile({
        filepath,
        table,
        csvOptions: task.csvOptions,
        fillEmptyAgencyId: task.fillEmptyAgencyId,
        agencyId: task.agencyId,
        batchSize: BATCH_SIZE,
      })) {
        try {
          await writer.writeBatch(batch.rows);
        } catch (error: unknown) {
          const gtfsError = toGtfsError(error, {
            message: error instanceof Error ? error.message : String(error),
            code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
            category: GtfsErrorCategory.DATABASE,
            details: { file: filename, ...target.errorDetails },
          });
          if (!task.ignoreErrors) {
            throw gtfsError;
          }

          log(
            task.config,
            'error',
            batch.isFinal
              ? `Error inserting data for ${filename}: ${gtfsError.message}`
              : `Error processing ${filename}: ${gtfsError.message}`,
          );
          reportTaskError(task, gtfsError);
          return;
        }

        totalRowCount = batch.totalRowCount;
        if (!batch.isFinal) {
          progress(task.config, formatFileCount(filename, totalRowCount));
        }
      }
    } catch (error: unknown) {
      const errorWasTyped = isGtfsError(error);
      const gtfsError = toGtfsError(error, {
        message: error instanceof Error ? error.message : String(error),
        code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
        category: GtfsErrorCategory.PARSE,
        details: { file: filename },
      });

      if (!task.ignoreErrors) {
        throw gtfsError;
      }

      if (gtfsError.code === GtfsErrorCode.GTFS_UNSUPPORTED_FILE_TYPE) {
        log(
          task.config,
          'error',
          `Unsupported file type: ${path.extname(filename).slice(1)} for ${filename}`,
        );
        return;
      }

      if (gtfsError.code === GtfsErrorCode.GTFS_JSON_INVALID) {
        log(task.config, 'error', `Invalid JSON in ${filename}`);
      } else if (path.extname(filename) === '.geojson') {
        log(
          task.config,
          'error',
          `Error reading ${filename}: ${gtfsError.message}`,
        );
      } else if (errorWasTyped) {
        log(
          task.config,
          'error',
          `Error processing ${filename}: ${gtfsError.message}`,
        );
      } else {
        log(
          task.config,
          'error',
          `Parser error for ${filename}: ${gtfsError.message}`,
        );
      }
      reportTaskError(task, gtfsError);
      return;
    }

    filesImported += 1;
    rowsImported += totalRowCount;
    status(task.config, formatFileCount(filename, totalRowCount));
  });

  task.filesImported = filesImported;
  task.rowsImported = rowsImported;

  if (missing.length > 0) {
    status(task.config, formatFileList('Not in this feed', missing));
  }
};

async function runStaticImport<Config extends GtfsImportConfig>(
  initialConfig: Config,
  targetFactory: (config: ResolvedImportConfig<Config>) => StaticImportTarget,
  sqliteTarget: boolean,
): Promise<void | ImportReport> {
  // Start timer
  const startTime = process.hrtime.bigint();

  validateConfig(initialConfig, (message) =>
    log(initialConfig, 'warning', message),
  );

  const config = applyConfigDefaults(initialConfig, STATIC_IMPORT_DEFAULTS);
  const sqlitePath =
    'sqlitePath' in config && typeof config.sqlitePath === 'string'
      ? config.sqlitePath
      : ':memory:';
  const importReport = config.includeImportReport
    ? createImportReport()
    : undefined;
  let runFiles = 0;
  let runRows = 0;
  let targetForError: StaticImportTarget | undefined;

  try {
    const target = targetFactory(config);
    targetForError = target;
    const agencyCount = config.agencies.length;

    report(config, {
      type: 'run:start',
      task: 'import',
      agencyCount,
      databaseDescription: target.databaseDescription,
    });

    await target.initialize();

    await mapSeries(config.agencies, async (agency: GtfsFeedConfig) => {
      const tempPath = temporaryDirectory();
      try {
        const task: GtfsImportTask = {
          exclude: agency.exclude,
          headers: agency.headers,
          realtimeAlerts: agency.realtimeAlerts,
          realtimeTripUpdates: agency.realtimeTripUpdates,
          realtimeVehiclePositions: agency.realtimeVehiclePositions,
          downloadDir: tempPath,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          csvOptions: config.csvOptions || {},
          ignoreDuplicates: config.ignoreDuplicates,
          ignoreErrors: config.ignoreErrors,
          prefix: agency.prefix,
          fillEmptyAgencyId: agency.fillEmptyAgencyId ?? false,
          agencyId: agency.agencyId,
          currentTimestamp: Math.floor(Date.now() / 1000),
          config,
          report: importReport,
        };

        if ('url' in agency) {
          Object.assign(task, { url: agency.url });

          await downloadGtfsFiles(task);
        } else {
          Object.assign(task, {
            path: agency.path,
          });
        }

        await extractGtfsFiles(task);

        if (task.fillEmptyAgencyId) {
          const agencyIdFromGtfs = await getSingleAgencyId(
            task.downloadDir,
            task.csvOptions,
            task.config,
          );

          if (agencyIdFromGtfs !== undefined) {
            if (
              task.agencyId !== undefined &&
              task.agencyId !== agencyIdFromGtfs
            ) {
              log(
                task.config,
                'warning',
                `\`agencyId\` "${task.agencyId}" does not match the \`agency_id\` "${agencyIdFromGtfs}" in agency.txt. Using the value from agency.txt.`,
              );
            }
            task.agencyId = agencyIdFromGtfs;
          } else if (task.agencyId === undefined) {
            log(
              task.config,
              'warning',
              '`fillEmptyAgencyId` is set but a single `agency_id` could not be determined for this feed and no `agencyId` was provided in config. `agency_id` will not be backfilled.',
            );
          }
        }

        await importGtfsFiles(target, task);
        runFiles += task.filesImported ?? 0;
        runRows += task.rowsImported ?? 0;
        await target.updateRealtime(task);
      } catch (error: unknown) {
        const wrappedError = toGtfsError(error, {
          message: error instanceof Error ? error.message : String(error),
          code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
          category: GtfsErrorCategory.PARSE,
          details:
            'path' in agency
              ? { agencyPath: agency.path }
              : { agencyUrl: agency.url },
        });
        if (config.ignoreErrors) {
          log(config, 'error', formatGtfsError(wrappedError));
          if (importReport) {
            addImportError(importReport, wrappedError);
          }
        } else {
          throw wrappedError;
        }
      } finally {
        await rm(tempPath, { recursive: true, force: true });
      }
    });

    status(config, 'Creating DB indexes');
    await target.finalize();

    const endTime = process.hrtime.bigint();
    const elapsedSeconds = Number(endTime - startTime) / 1_000_000_000;

    report(config, {
      type: 'run:complete',
      task: 'import',
      elapsedSeconds,
      summary: `${pluralize('file', 'files', runFiles)}, ${formatCount(runRows)} rows`,
    });
  } catch (error: unknown) {
    if (
      sqliteTarget &&
      (error as Error & { code?: string }).code === 'SQLITE_CANTOPEN'
    ) {
      const dbOpenError = new GtfsError(
        `Unable to open sqlite database "${sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
        {
          code: GtfsErrorCode.DB_OPEN_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: {
            sqlitePath,
            dbCode: (error as Error & { code?: string }).code,
          },
          cause: error,
        },
      );
      log(config, 'error', dbOpenError.message);
      throw dbOpenError;
    }
    throw toGtfsError(error, {
      message: error instanceof Error ? error.message : String(error),
      code: sqliteTarget
        ? GtfsErrorCode.GTFS_CSV_PARSE_FAILED
        : GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
      category: sqliteTarget
        ? GtfsErrorCategory.PARSE
        : GtfsErrorCategory.DATABASE,
      details: targetForError?.errorDetails ?? {
        sqlitePath,
      },
    });
  }

  if (importReport) {
    return importReport;
  }
}

/** Imports GTFS into SQLite. */
export async function importGtfs(
  initialConfig: GtfsSqliteImportConfig & { includeImportReport: true },
): Promise<ImportReport>;
export async function importGtfs(
  initialConfig: GtfsSqliteImportConfig & {
    includeImportReport?: false | undefined;
  },
): Promise<void>;
export async function importGtfs(
  initialConfig: GtfsSqliteImportConfig,
): Promise<void | ImportReport>;
export async function importGtfs(
  initialConfig: GtfsSqliteImportConfig,
): Promise<void | ImportReport> {
  return runStaticImport(
    initialConfig,
    (config) => createSqliteImportTarget(openDb(config), config),
    true,
  );
}

/** Imports static GTFS through a caller-owned Kysely instance. */
export async function importGtfsToKysely<DB>(
  initialConfig: GtfsImportConfig & { includeImportReport: true },
  databaseOptions: KyselyImportOptions<DB>,
): Promise<ImportReport>;
export async function importGtfsToKysely<DB>(
  initialConfig: GtfsImportConfig & {
    includeImportReport?: false | undefined;
  },
  databaseOptions: KyselyImportOptions<DB>,
): Promise<void>;
export async function importGtfsToKysely<DB>(
  initialConfig: GtfsImportConfig,
  databaseOptions: KyselyImportOptions<DB>,
): Promise<void | ImportReport>;
export async function importGtfsToKysely<DB>(
  initialConfig: GtfsImportConfig,
  databaseOptions: KyselyImportOptions<DB>,
): Promise<void | ImportReport> {
  return runStaticImport(
    initialConfig,
    () => createKyselyImportTarget(databaseOptions),
    false,
  );
}
