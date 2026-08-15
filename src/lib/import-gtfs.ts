import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { cp, readdir, rename, readFile, rm, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { temporaryDirectory, untildify, unzip } from './file-utils.ts';
import { isValidJSON } from './geojson-utils.ts';
import { updateGtfsRealtimeData } from './import-gtfs-realtime.ts';
import { log, progress, report, status } from '../reporting/report.ts';
import { pluralize } from '../reporting/format.ts';
import { validateConfig } from './validate-config.ts';
import {
  getTimestampColumnName,
  padLeadingZeros,
  applyPrefixToValue,
  mapSeries,
  setDefaultConfig,
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
  fillEmptyAgencyId: boolean;
  agencyId?: string;
  currentTimestamp: number;
  config: Config;
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

  status(task.config, `Downloading GTFS from ${task.url}`);

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
    status(task.config, 'Download successful');
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
  status(task.config, `Importing static GTFS from ${task.path}`);
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
  config: Config,
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
  for (const model of Object.values(models) as Model[]) {
    if (!model.schema) {
      continue;
    }

    const sqlColumnCreateStatements = [];

    for (const column of model.schema) {
      const checks = [];
      if (column.min !== undefined && column.max !== undefined) {
        checks.push(
          `${column.name} >= ${column.min} AND ${column.name} <= ${column.max}`,
        );
      } else if (column.min !== undefined) {
        checks.push(`${column.name} >= ${column.min}`);
      } else if (column.max !== undefined) {
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

// For columns that are mostly empty, use a partial index (`WHERE column IS NOT NULL`) instead of a full index.
const SPARSE_COLUMN_MAX_DENSITY = 0.1;

const createGtfsIndex = (
  db: Database.Database,
  tableName: string,
  columnName: string,
  partial: boolean,
): void => {
  const predicate = partial ? ` WHERE ${columnName} IS NOT NULL` : '';
  db.prepare(
    `CREATE INDEX idx_${tableName}_${columnName} ON ${tableName} (${columnName})${predicate};`,
  ).run();
};

const createGtfsIndexes = (db: Database.Database): void => {
  for (const model of Object.values(models) as Model[]) {
    if (!model.schema) {
      continue;
    }

    const indexedColumns: string[] = [];

    for (const column of model.schema) {
      if (column.index) {
        indexedColumns.push(column.name);
      }

      // Index all timestamp columns
      if (column.type === 'time') {
        indexedColumns.push(getTimestampColumnName(column.name));
      }
    }

    if (indexedColumns.length === 0) {
      continue;
    }

    const { rowCount } = db
      .prepare(`SELECT COUNT(*) AS rowCount FROM ${model.filenameBase}`)
      .get() as { rowCount: number };

    if (rowCount === 0) {
      for (const columnName of indexedColumns) {
        createGtfsIndex(db, model.filenameBase, columnName, false);
      }
      continue;
    }

    // Count non-null values for each indexed column using COUNT(column) to skip NULLs
    const counts = db
      .prepare(
        `SELECT ${indexedColumns
          .map((columnName, index) => `COUNT(${columnName}) AS c${index}`)
          .join(', ')} FROM ${model.filenameBase}`,
      )
      .get() as Record<string, number>;

    for (const [index, columnName] of indexedColumns.entries()) {
      const density = counts[`c${index}`] / rowCount;
      createGtfsIndex(
        db,
        model.filenameBase,
        columnName,
        density <= SPARSE_COLUMN_MAX_DENSITY,
      );
    }
  }
};

const AGENCY_ID_BACKFILL_MODELS = new Set([
  'agency',
  'routes',
  'fare_attributes',
  'trip_capacity',
  'rider_trip',
  'ridership',
]);

function shouldBackfillAgencyId(
  model: Model,
  formattedLine: (string | null)[],
  columnIndexes: Map<string, number>,
): boolean {
  if (AGENCY_ID_BACKFILL_MODELS.has(model.filenameBase)) {
    return true;
  }

  if (model.filenameBase === 'attributions') {
    // Per GTFS spec, agency_id, route_id, and trip_id are mutually exclusive.
    // Only backfill when the row isn't already scoped to a route or trip.
    const routeIdIndex = columnIndexes.get('route_id');
    const tripIdIndex = columnIndexes.get('trip_id');
    return (
      (routeIdIndex === undefined || formattedLine[routeIdIndex] == null) &&
      (tripIdIndex === undefined || formattedLine[tripIdIndex] == null)
    );
  }

  return false;
}

const formatGtfsLine = (
  line: { [x: string]: string | null },
  model: Model,
  totalLineCount: number,
  fillEmptyAgencyId: boolean,
  agencyId: string | undefined,
  columnIndexes: Map<string, number>,
): (string | null)[] => {
  const lineNumber = totalLineCount + 1;
  const formattedLine: (string | null)[] = new Array(model.schema.length);
  const filenameBase = model.filenameBase;
  const filenameExtension = model.filenameExtension;

  for (let index = 0; index < model.schema.length; index++) {
    const { name, type, required } = model.schema[index];
    let value: string | null = line[name];

    // Early null check
    if (value === '' || value === undefined || value === null) {
      formattedLine[index] = null;

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

    formattedLine[index] = value;
  }

  const agencyIdIndex = columnIndexes.get('agency_id');

  if (
    fillEmptyAgencyId &&
    agencyId !== undefined &&
    agencyIdIndex !== undefined &&
    formattedLine[agencyIdIndex] == null &&
    shouldBackfillAgencyId(model, formattedLine, columnIndexes)
  ) {
    // Fill raw value — applyPrefixToValue handles prefixing at insert time
    // since agency_id is marked prefix: true in all affected models.
    formattedLine[agencyIdIndex] = agencyId;
  }

  return formattedLine;
};

const BATCH_SIZE = 100_000;

const importGtfsFiles = async (
  db: Database.Database,
  task: GtfsImportTask,
): Promise<void> => {
  await mapSeries(
    Object.values(models) as Model[],
    (model: Model) =>
      new Promise<void>((resolve, reject) => {
        let totalLineCount = 0;
        const filename = `${model.filenameBase}.${model.filenameExtension}`;

        // Skip any models that are excluded by config
        if (task.exclude && task.exclude.includes(model.filenameBase)) {
          status(task.config, `Skipping - ${filename}`);
          resolve();
          return;
        }

        // Skip gtfs-realtime models not present in static GTFS
        if (model.extension === 'gtfs-realtime') {
          resolve();
          return;
        }

        const filepath = path.join(task.downloadDir, `${filename}`);

        /*
         * Only announce missing standard GTFS files.
         */
        if (!existsSync(filepath)) {
          if (!model.nonstandard && !model.extension) {
            status(task.config, `Importing - ${filename} - No file found`);
          }

          resolve();
          return;
        }

        progress(task.config, `Importing - ${filename}`);

        // Create a list of all columns
        const columns = model.schema;

        // Positional lookups, computed once per file rather than per row
        const columnIndexes = new Map(
          columns.map((column, index) => [column.name, index]),
        );
        const prefixedColumns = columns.map((column) => Boolean(column.prefix));

        const prepareStatement = `INSERT ${task.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${
          model.filenameBase
        } (${columns.map(({ name }) => name).join(', ')}) VALUES (${columns
          .map(() => '?')
          .join(', ')})`;

        const insert = db.prepare(prepareStatement);

        const insertLines = db.transaction((lines) => {
          for (let rowNumber = 0; rowNumber < lines.length; rowNumber++) {
            const line = lines[rowNumber];
            try {
              if (task.prefix === undefined) {
                insert.run(line as SqlValue[]);
              } else {
                const values = line as SqlValue[];
                const prefixedLine = new Array(values.length);
                for (let index = 0; index < values.length; index++) {
                  prefixedLine[index] = applyPrefixToValue(
                    values[index] as string,
                    prefixedColumns[index],
                    task.prefix,
                  );
                }
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
                log(
                  task.config,
                  'warning',
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

              log(
                task.config,
                'warning',
                `Skipping invalid data in ${filename} on line ${rowNumber + 1}`,
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
            bom: true,
            ...task.csvOptions,
          });

          let lines: (string | null)[][] = [];

          parser.on('readable', () => {
            try {
              let record;

              while ((record = parser.read())) {
                totalLineCount += 1;
                lines.push(
                  formatGtfsLine(
                    record,
                    model,
                    totalLineCount,
                    task.fillEmptyAgencyId,
                    task.agencyId,
                    columnIndexes,
                  ),
                );

                if (lines.length >= BATCH_SIZE) {
                  insertLines(lines);
                  lines = [];

                  progress(
                    task.config,
                    `Importing - ${filename} - ${pluralize('line', 'lines', totalLineCount)} imported`,
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
                log(
                  task.config,
                  'error',
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
                    log(
                      task.config,
                      'error',
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
              status(
                task.config,
                `Importing - ${filename} - ${pluralize('line', 'lines', totalLineCount)} imported`,
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
                log(
                  task.config,
                  'error',
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
              log(
                task.config,
                'error',
                `Parser error for ${filename}: ${gtfsError.message}`,
              );
              reportTaskError(task, gtfsError);
              resolve();
            } else {
              reject(gtfsError);
            }
          });

          createReadStream(filepath).pipe(parser);
        } else if (model.filenameExtension === 'geojson') {
          readFile(filepath, 'utf8')
            .then((data) => {
              if (isValidJSON(data) === false) {
                if (task.ignoreErrors) {
                  log(task.config, 'error', `Invalid JSON in ${filename}`);
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
                task.fillEmptyAgencyId,
                task.agencyId,
                columnIndexes,
              );
              try {
                insertLines([line]);
                status(
                  task.config,
                  `Importing - ${filename} - ${pluralize('line', 'lines', totalLineCount)} imported`,
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
                  log(
                    task.config,
                    'error',
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
                log(
                  task.config,
                  'error',
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
            log(
              task.config,
              'error',
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
  status(task.config, 'Static GTFS import complete');
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

  validateConfig(initialConfig, (message) =>
    log(initialConfig, 'warning', message),
  );

  const config = setDefaultConfig(initialConfig);
  const importReport = config.includeImportReport
    ? createImportReport()
    : undefined;

  try {
    const db = openDb(config);
    const agencyCount = config.agencies.length;

    report(config, {
      type: 'run:start',
      task: 'import',
      agencyCount,
      sqlitePath: config.sqlitePath ?? ':memory:',
    });

    createGtfsTables(db);

    await mapSeries(config.agencies, async (agency: ConfigAgency) => {
      try {
        const tempPath = temporaryDirectory();

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
          sqlitePath: config.sqlitePath,
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
          log(config, 'error', formatGtfsError(wrappedError));
          if (importReport) {
            addImportError(importReport, wrappedError);
          }
        } else {
          throw wrappedError;
        }
      }
    });

    status(config, 'Creating DB indexes');
    createGtfsIndexes(db);

    const endTime = process.hrtime.bigint();
    const elapsedSeconds = Number(endTime - startTime) / 1_000_000_000;

    report(config, {
      type: 'run:complete',
      task: 'import',
      elapsedSeconds,
    });
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
      log(config, 'error', dbOpenError.message);
      throw dbOpenError;
    }
    throw toGtfsError(error, {
      message: error instanceof Error ? error.message : String(error),
      code: GtfsErrorCode.GTFS_CSV_PARSE_FAILED,
      category: GtfsErrorCategory.PARSE,
    });
  }

  if (importReport) {
    return importReport;
  }
}
