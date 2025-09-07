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
}

const getTextFiles = async (folderPath: string): Promise<string[]> => {
  const files = await readdir(folderPath);
  return files.filter((filename) => filename.slice(-3) === 'txt');
};

const downloadGtfsFiles = async (task: GtfsImportTask): Promise<void> => {
  if (!task.url) {
    throw new Error('No `url` specified in config');
  }

  task.log(`Downloading GTFS from ${task.url}`);

  task.path = `${task.downloadDir}/gtfs.zip`;

  const response = await fetch(task.url, {
    method: 'GET',
    headers: task.headers || {},
    signal: task.downloadTimeout
      ? AbortSignal.timeout(task.downloadTimeout)
      : undefined,
  });

  if (response.status !== 200) {
    throw new Error(
      `Unable to download GTFS from ${task.url}. Got status ${response.status}.`,
    );
  }

  const buffer = await response.arrayBuffer();

  await writeFile(task.path, Buffer.from(buffer));
  task.log('Download successful');
};

const extractGtfsFiles = async (task: GtfsImportTask): Promise<void> => {
  if (!task.path) {
    throw new Error('No `path` specified in config');
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
          throw new Error(
            `More than one subfolder found in zip file at \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
          );
        } else if (folders.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
          );
        }

        const subfolderName = folders[0];
        const directoryTextFiles = await getTextFiles(subfolderName);

        if (directoryTextFiles.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
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
      task.logError(error as string);
      throw new Error(`Unable to unzip file ${task.path}`);
    }
  } else {
    // Local file is unzipped, just copy it from there.
    try {
      await cp(gtfsPath, task.downloadDir, { recursive: true });
    } catch {
      throw new Error(
        `Unable to load files from path \`${gtfsPath}\` defined in configuration. Verify that path exists and contains GTFS files.`,
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
        throw new Error(
          `Missing required value in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}.`,
        );
      }
      continue;
    }

    if (type === 'date') {
      // Handle YYYY-MM-DD format
      value = value?.toString().replace(/-/g, '');
      if (value.length !== 8) {
        throw new Error(
          `Invalid date in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}.`,
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
              }

              task.logWarning(
                `Check ${filename} for invalid data on line ${rowNumber + 1}.`,
              );
              throw error;
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
              if (task.ignoreErrors) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                task.logError(`Error processing ${filename}: ${errorMessage}`);
                resolve();
              } else {
                reject(error);
              }
            }
          });

          parser.on('end', () => {
            try {
              if (lines.length > 0) {
                try {
                  insertLines(lines);
                } catch (error: unknown) {
                  if (task.ignoreErrors) {
                    const errorMessage =
                      error instanceof Error ? error.message : String(error);
                    task.logError(
                      `Error inserting data for ${filename}: ${errorMessage}`,
                    );
                    resolve();
                    return;
                  } else {
                    reject(error);
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
              if (task.ignoreErrors) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                task.logError(`Error finalizing ${filename}: ${errorMessage}`);
                resolve();
              } else {
                reject(error);
              }
            }
          });

          parser.on('error', (error: unknown) => {
            if (task.ignoreErrors) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              task.logError(`Parser error for ${filename}: ${errorMessage}`);
              resolve();
            } else {
              reject(error);
            }
          });

          createReadStream(filepath).pipe(stripBomStream()).pipe(parser);
        } else if (model.filenameExtension === 'geojson') {
          readFile(filepath, 'utf8')
            .then((data) => {
              if (isValidJSON(data) === false) {
                if (task.ignoreErrors) {
                  task.logError(`Invalid JSON in ${filename}`);
                  resolve();
                  return;
                } else {
                  reject(new Error(`Invalid JSON in ${filename}`));
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
                if (task.ignoreErrors) {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  task.logError(
                    `Error inserting data for ${filename}: ${errorMessage}`,
                  );
                  resolve();
                } else {
                  reject(error);
                }
              }
            })
            .catch((error: unknown) => {
              if (task.ignoreErrors) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                task.logError(`Error reading ${filename}: ${errorMessage}`);
                resolve();
              } else {
                reject(error);
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
              new Error(`Unsupported file type: ${model.filenameExtension}`),
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
export async function importGtfs(initialConfig: Config): Promise<void> {
  // Start timer
  const startTime = process.hrtime.bigint();

  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);

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
        if (config.ignoreErrors) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logError(config)(errorMessage);
        } else {
          throw error;
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
      logError(config)(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }
    throw error;
  }
}
