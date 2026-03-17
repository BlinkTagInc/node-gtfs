import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { cp, readdir, rename, readFile, rm, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse';
import stripBomStream from 'strip-bom-stream';
import { temporaryDirectory } from 'tempy';
import mapSeries from 'promise-map-series';
import Database from 'better-sqlite3';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { untildify, unzip } from './file-utils.ts';
import { isValidJSON } from './geojson-utils.ts';
import { updateGtfsRealtimeData } from './import-gtfs-realtime.ts';
import { log, logError, logWarning } from './log-utils.ts';
import {
  getTimestampColumnName,
  padLeadingZeros,
  applyPrefixToValue,
  pluralize,
  setDefaultConfig,
  validateConfigForImport,
} from './utils.ts';
import {
  addImportError,
  addImportWarning,
  createImportReport,
  formatGtfsError,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsWarningCode,
  ImportReport,
  toGtfsError,
} from './errors.ts';

import {
  Config,
  ConfigAgency,
  Model,
  SqlValue,
  TableNames,
} from '../types/global_interfaces.ts';

interface GtfsImportTask {
  exclude?: TableNames[];
  url?: string;
  headers?: Record<string, string>;
  realtimeAlerts?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeTripUpdates?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeVehiclePositions?: {
    url: string;
    headers?: Record<string, string>;
  };
  downloadDir: string;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  path?: string;
  csvOptions: object;
  ignoreDuplicates: boolean;
  ignoreErrors: boolean;
  sqlitePath: string;
  prefix?: string;
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
  report?: ImportReport;
}

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

  task.log(`Downloading GTFS from ${task.url}`);

  task.path = `${task.downloadDir}/gtfs.zip`;

  try {
    const response = await fetch(task.url, {
      method: 'GET',
      headers: task.headers || {},
      signal: task.downloadTimeout
        ? AbortSignal.timeout(task.downloadTimeout)
        : undefined,
    });

    if (response.status !== 200) {
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
    task.log('Download successful');
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
  task.log(`Importing static GTFS from ${task.path}\r`);
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
      task.logError(formatGtfsError(wrappedError));
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

const createGtfsTables = (db: Database.Database): void => {
  for (const model of Object.values(models) as Model[]) {
    if (!model.schema) {
      return;
    }

    const sqlColumnCreateStatements = [];

    for (const column of model.schema) {
      const checks = [];
      if (column.min !== undefined && column.max) {
        checks.push(
          `${column.name} >= ${column.min} AND ${column.name} <= ${column.max}`,
        );
      } else if (column.min) {
        checks.push(`${column.name} >= ${column.min}`);
      } else if (column.max) {
        checks.push(`${column.name} <= ${column.max}`);
      }

      if (column.type === 'integer') {
        checks.push(
          `(TYPEOF(${column.name}) = 'integer' OR ${column.name} IS NULL)`,
        );
      } else if (column.type === 'real') {
        checks.push(
          `(TYPEOF(${column.name}) = 'real' OR ${column.name} IS NULL)`,
        );
      }

      const required = column.required ? 'NOT NULL' : '';
      const columnDefault = column.default ? 'DEFAULT ' + column.default : '';
      const columnCollation = column.nocase ? 'COLLATE NOCASE' : '';
      const checkClause =
        checks.length > 0 ? `CHECK(${checks.join(' AND ')})` : '';

      sqlColumnCreateStatements.push(
        `${column.name} ${column.type} ${checkClause} ${required} ${columnDefault} ${columnCollation}`,
      );

      // Add an additional timestamp column for time columns
      if (column.type === 'time') {
        sqlColumnCreateStatements.push(
          `${getTimestampColumnName(column.name)} INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN ${column.name} IS NULL OR ${column.name} = '' THEN NULL
              ELSE CAST(
                substr(${column.name}, 1, instr(${column.name}, ':') - 1) * 3600 +
                substr(${column.name}, instr(${column.name}, ':') + 1, 2) * 60 +
                substr(${column.name}, -2) AS INTEGER
              )
            END
          ) STORED`,
        );
      }
    }

    // Find Primary Key fields
    const primaryColumns = model.schema.filter((column) => column.primary);

    if (primaryColumns.length > 0) {
      sqlColumnCreateStatements.push(
        `PRIMARY KEY (${primaryColumns.map(({ name }) => name).join(', ')})`,
      );
    }

    db.prepare(`DROP TABLE IF EXISTS ${model.filenameBase};`).run();

    db.prepare(
      `CREATE TABLE ${model.filenameBase} (${sqlColumnCreateStatements.join(', ')});`,
    ).run();
  }
};

const createGtfsIndexes = (db: Database.Database): void => {
  for (const model of Object.values(models) as Model[]) {
    if (!model.schema) {
      return;
    }
    for (const column of model.schema) {
      if (column.index) {
        db.prepare(
          `CREATE INDEX idx_${model.filenameBase}_${column.name} ON ${model.filenameBase} (${column.name});`,
        ).run();
      }

      if (column.type === 'time') {
        // Index all timestamp columns
        const timestampColumnName = getTimestampColumnName(column.name);
        db.prepare(
          `CREATE INDEX idx_${model.filenameBase}_${timestampColumnName} ON ${model.filenameBase} (${timestampColumnName});`,
        ).run();
      }
    }
  }
};

const formatGtfsLine = (
  line: { [x: string]: string | null },
  model: Model,
  totalLineCount: number,
): Record<string, string | null> => {
  const lineNumber = totalLineCount + 1;
  const formattedLine: Record<string, string | null> = {};
  const filenameBase = model.filenameBase;
  const filenameExtension = model.filenameExtension;

  for (const { name, type, required } of model.schema) {
    let value: string | null = line[name];

    // Early null check
    if (value === '' || value === undefined || value === null) {
      formattedLine[name] = null;

      if (required) {
        throw new GtfsError(
          `Missing required value in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}.`,
          {
            code: GtfsErrorCode.GTFS_REQUIRED_FIELD_MISSING,
            category: GtfsErrorCategory.VALIDATION,
            details: {
              file: `${filenameBase}.${filenameExtension}`,
              line: lineNumber,
              column: name,
            },
          },
        );
      }
      continue;
    }

    if (type === 'date') {
      // Handle YYYY-MM-DD format
      value = value?.toString().replace(/-/g, '');
      if (value.length !== 8) {
        throw new GtfsError(
          `Invalid date in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}.`,
          {
            code: GtfsErrorCode.GTFS_INVALID_DATE,
            category: GtfsErrorCategory.VALIDATION,
            details: {
              file: `${filenameBase}.${filenameExtension}`,
              line: lineNumber,
              column: name,
              value,
            },
          },
        );
      }
    } else if (type === 'time') {
      value = padLeadingZeros(value);
    }

    if (type === 'json') {
      value = JSON.stringify(value);
    }

    formattedLine[name] = value;
  }

  return formattedLine;
};

const BATCH_SIZE = 100_000;

const importGtfsFiles = async (
  db: Database.Database,
  task: GtfsImportTask,
): Promise<void> => {
  await mapSeries(
    Object.values(models),
    (model: Model) =>
      new Promise<void>((resolve, reject) => {
        let totalLineCount = 0;
        const filename = `${model.filenameBase}.${model.filenameExtension}`;

        // Skip any models that are excluded by config
        if (task.exclude && task.exclude.includes(model.filenameBase)) {
          task.log(`Skipping - ${filename}\r`);
          resolve();
          return;
        }

        // Skip gtfs-realtime models not present in static GTFS
        if (model.extension === 'gtfs-realtime') {
          resolve();
          return;
        }

        const filepath = path.join(task.downloadDir, `${filename}`);

        // Log missing standard GTFS files, don't log nonstandard files
        if (!existsSync(filepath)) {
          if (!model.nonstandard) {
            task.log(`Importing - ${filename} - No file found\r`);
          }

          resolve();
          return;
        }

        task.log(`Importing - ${filename}\r`);

        // Create a list of all columns
        const columns = model.schema;

        // Create a map of which columns need prefixing
        const prefixedColumns = new Set(
          columns
            .filter((column) => column.prefix)
            .map((column) => column.name),
        );

        const prepareStatement = `INSERT ${task.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${
          model.filenameBase
        } (${columns.map(({ name }) => name).join(', ')}) VALUES (${columns
          .map(({ name }) => `@${name}`)
          .join(', ')})`;

        const insert = db.prepare(prepareStatement);

        const insertLines = db.transaction((lines) => {
          for (const [rowNumber, line] of Object.entries(lines)) {
            try {
              if (task.prefix === undefined) {
                insert.run(line);
              } else {
                const prefixedLine = Object.fromEntries(
                  Object.entries(
                    line as { [x: string]: unknown; geojson?: string },
                  ).map(([columnName, value]) => [
                    columnName,
                    applyPrefixToValue(
                      value as string,
                      prefixedColumns.has(columnName),
                      task.prefix,
                    ),
                  ]),
                );
                insert.run(prefixedLine);
              }
            } catch (error: unknown) {
              if (
                (error as Error & { code?: string }).code ===
                'SQLITE_CONSTRAINT_PRIMARYKEY'
              ) {
                const primaryColumns = columns.filter(
                  (column) => column.primary,
                );
                task.logWarning(
                  `Duplicate values for primary key (${primaryColumns.map((column) => column.name).join(', ')}) found in ${filename}. Set the \`ignoreDuplicates\` option to true in config.json to ignore this error`,
                );
                if (task.report) {
                  addImportWarning(task.report, {
                    code: GtfsWarningCode.GTFS_DUPLICATE_PRIMARY_KEY,
                    message: `Duplicate values for primary key found in ${filename}.`,
                    details: {
                      file: filename,
                      line: Number(rowNumber) + 1,
                      columns: primaryColumns.map((column) => column.name),
                    },
                  });
                }
              }

              task.logWarning(
                `Check ${filename} for invalid data on line ${rowNumber + 1}.`,
              );
              throw toGtfsError(error, {
                message: error instanceof Error ? error.message : String(error),
                code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
                category: GtfsErrorCategory.DATABASE,
                details: {
                  file: filename,
                  line: Number(rowNumber) + 1,
                  sqlitePath: task.sqlitePath,
                  dbCode: (error as { code?: unknown }).code,
                },
              });
            }
          }
        });

        if (model.filenameExtension === 'txt') {
          const parser = parse({
            columns: true,
            relax_quotes: true,
            trim: true,
            skip_empty_lines: true,
            ...task.csvOptions,
          });

          let lines: { [x: string]: SqlValue; geojson?: string }[] = [];

          parser.on('readable', () => {
            try {
              let record;

              while ((record = parser.read())) {
                totalLineCount += 1;
                lines.push(formatGtfsLine(record, model, totalLineCount));

                if (lines.length >= BATCH_SIZE) {
                  insertLines(lines);
                  lines = [];

                  task.log(
                    `Importing - ${filename} - ${totalLineCount} lines imported\r`,
                    true,
                  );
                }
              }
            } catch (error: unknown) {
              const gtfsError = toGtfsError(error, {
                message: error instanceof Error ? error.message : String(error),
                code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
                category: GtfsErrorCategory.PARSE,
                details: { file: filename },
              });
              if (task.ignoreErrors) {
                reportTaskError(task, gtfsError);
                task.logError(
                  `Error processing ${filename}: ${gtfsError.message}`,
                );
                resolve();
              } else {
                reject(gtfsError);
              }
            }
          });

          parser.on('end', () => {
            try {
              if (lines.length > 0) {
                try {
                  insertLines(lines);
                } catch (error: unknown) {
                  const gtfsError = toGtfsError(error, {
                    message:
                      error instanceof Error ? error.message : String(error),
                    code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
                    category: GtfsErrorCategory.DATABASE,
                    details: { file: filename, sqlitePath: task.sqlitePath },
                  });
                  if (task.ignoreErrors) {
                    task.logError(
                      `Error inserting data for ${filename}: ${gtfsError.message}`,
                    );
                    reportTaskError(task, gtfsError);
                    resolve();
                    return;
                  } else {
                    reject(gtfsError);
                    return;
                  }
                }
              }
              task.log(
                `Importing - ${filename} - ${totalLineCount} lines imported\r`,
                true,
              );
              resolve();
            } catch (error: unknown) {
              const gtfsError = toGtfsError(error, {
                message: error instanceof Error ? error.message : String(error),
                code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
                category: GtfsErrorCategory.DATABASE,
                details: { file: filename, sqlitePath: task.sqlitePath },
              });
              if (task.ignoreErrors) {
                task.logError(
                  `Error finalizing ${filename}: ${gtfsError.message}`,
                );
                reportTaskError(task, gtfsError);
                resolve();
              } else {
                reject(gtfsError);
              }
            }
          });

          parser.on('error', (error: unknown) => {
            const gtfsError = toGtfsError(error, {
              message: error instanceof Error ? error.message : String(error),
              code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
              category: GtfsErrorCategory.PARSE,
              details: { file: filename },
            });
            if (task.ignoreErrors) {
              task.logError(
                `Parser error for ${filename}: ${gtfsError.message}`,
              );
              reportTaskError(task, gtfsError);
              resolve();
            } else {
              reject(gtfsError);
            }
          });

          createReadStream(filepath).pipe(stripBomStream()).pipe(parser);
        } else if (model.filenameExtension === 'geojson') {
          readFile(filepath, 'utf8')
            .then((data) => {
              if (isValidJSON(data) === false) {
                if (task.ignoreErrors) {
                  task.logError(`Invalid JSON in ${filename}`);
                  reportTaskError(
                    task,
                    new GtfsError(`Invalid JSON in ${filename}`, {
                      code: GtfsErrorCode.GTFS_JSON_INVALID,
                      category: GtfsErrorCategory.PARSE,
                      details: { file: filename },
                    }),
                  );
                  resolve();
                  return;
                } else {
                  reject(
                    new GtfsError(`Invalid JSON in ${filename}`, {
                      code: GtfsErrorCode.GTFS_JSON_INVALID,
                      category: GtfsErrorCategory.PARSE,
                      details: { file: filename },
                    }),
                  );
                  return;
                }
              }
              totalLineCount += 1;
              const line = formatGtfsLine(
                { geojson: data },
                model,
                totalLineCount,
              );
              try {
                insertLines([line]);
                task.log(
                  `Importing - ${filename} - ${totalLineCount} lines imported\r`,
                  true,
                );
                resolve();
              } catch (error: unknown) {
                const gtfsError = toGtfsError(error, {
                  message:
                    error instanceof Error ? error.message : String(error),
                  code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
                  category: GtfsErrorCategory.DATABASE,
                  details: { file: filename, sqlitePath: task.sqlitePath },
                });
                if (task.ignoreErrors) {
                  task.logError(
                    `Error inserting data for ${filename}: ${gtfsError.message}`,
                  );
                  reportTaskError(task, gtfsError);
                  resolve();
                } else {
                  reject(gtfsError);
                }
              }
            })
            .catch((error: unknown) => {
              const gtfsError = toGtfsError(error, {
                message: error instanceof Error ? error.message : String(error),
                code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
                category: GtfsErrorCategory.PARSE,
                details: { file: filename },
              });
              if (task.ignoreErrors) {
                task.logError(
                  `Error reading ${filename}: ${gtfsError.message}`,
                );
                reportTaskError(task, gtfsError);
                resolve();
              } else {
                reject(gtfsError);
              }
            });
        } else {
          if (task.ignoreErrors) {
            task.logError(
              `Unsupported file type: ${model.filenameExtension} for ${filename}`,
            );
            resolve();
          } else {
            reject(
              new GtfsError(
                `Unsupported file type: ${model.filenameExtension}`,
                {
                  code: GtfsErrorCode.GTFS_UNSUPPORTED_FILE_TYPE,
                  category: GtfsErrorCategory.PARSE,
                  details: {
                    file: filename,
                    extension: model.filenameExtension,
                  },
                },
              ),
            );
          }
        }
      }),
  );
  task.log(`Static GTFS import complete`);
};

/**
 * Function to import GTFS files into the database
 *
 * @param initialConfig
 */
export async function importGtfs(initialConfig: Config): Promise<ImportReport>;
export async function importGtfs(initialConfig: Config): Promise<void>;
export async function importGtfs(
  initialConfig: Config,
): Promise<void | ImportReport> {
  // Start timer
  const startTime = process.hrtime.bigint();

  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const report = config.includeImportReport ? createImportReport() : undefined;

  try {
    const db = openDb(config);
    const agencyCount = config.agencies.length;

    log(config)(
      `Starting GTFS import for ${pluralize('file', 'files', agencyCount)} using SQLite database at ${config.sqlitePath}`,
    );

    createGtfsTables(db);

    await mapSeries(config.agencies, async (agency: ConfigAgency) => {
      try {
        const tempPath = temporaryDirectory();

        const task = {
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
          sqlitePath: config.sqlitePath,
          prefix: agency.prefix,
          currentTimestamp: Math.floor(Date.now() / 1000),
          log: log(config),
          logWarning: logWarning(config),
          logError: logError(config),
          report,
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
        await importGtfsFiles(db, task);
        await updateGtfsRealtimeData(task);

        await rm(tempPath, { recursive: true });
      } catch (error: unknown) {
        const wrappedError = toGtfsError(error, {
          message: error instanceof Error ? error.message : String(error),
          code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
          category: GtfsErrorCategory.PARSE,
        });
        if (config.ignoreErrors) {
          logError(config)(formatGtfsError(wrappedError));
          if (report) {
            addImportError(report, wrappedError);
          }
        } else {
          throw wrappedError;
        }
      }
    });

    log(config)(`Creating DB indexes`);
    createGtfsIndexes(db);

    const endTime = process.hrtime.bigint();
    const elapsedSeconds = Number(endTime - startTime) / 1_000_000_000;

    log(config)(
      `Completed GTFS import in ${elapsedSeconds.toFixed(1)} seconds\n`,
    );
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === 'SQLITE_CANTOPEN') {
      const dbOpenError = new GtfsError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
        {
          code: GtfsErrorCode.DB_OPEN_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: {
            sqlitePath: config.sqlitePath,
            dbCode: (error as Error & { code?: string }).code,
          },
          cause: error,
        },
      );
      logError(config)(dbOpenError.message);
      throw dbOpenError;
    }
    throw toGtfsError(error, {
      message: error instanceof Error ? error.message : String(error),
      code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
      category: GtfsErrorCategory.PARSE,
    });
  }

  if (report) {
    return report;
  }
}
