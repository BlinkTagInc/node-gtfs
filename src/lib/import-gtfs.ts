import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { cp, readdir, rename, readFile, rm, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse';
import pluralize from 'pluralize';
import stripBomStream from 'strip-bom-stream';
import { temporaryDirectory } from 'tempy';
import Timer from 'timer-machine';
import untildify from 'untildify';
import mapSeries from 'promise-map-series';
import Database from 'better-sqlite3';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { unzip } from './file-utils.ts';
import { isValidJSON } from './geojson-utils.ts';
import { updateGtfsRealtimeData } from './import-gtfs-realtime.ts';
import {
  log as _log,
  logError as _logError,
  logWarning as _logWarning,
} from './log-utils.ts';
import {
  calculateSecondsFromMidnight,
  setDefaultConfig,
  validateConfigForImport,
  padLeadingZeros,
} from './utils.ts';

import { Config, ConfigAgency, Model } from '../types/global_interfaces.ts';

interface GtfsImportTask {
  exclude?: string[];
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
  csvOptions: {};
  ignoreDuplicates: boolean;
  ignoreErrors: boolean;
  sqlitePath: string;
  prefix?: string;
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

interface Dictionary<T> {
  [key: string]: T;
}
type Tuple = [seconds: number | null, date: string | null];

const dateCache: Dictionary<Tuple> = {};

const calculateAndCacheDate = (value: string): Tuple => {
  const cached = dateCache[value];
  if (cached != null) {
    return cached;
  }

  const seconds = calculateSecondsFromMidnight(value);
  const date = padLeadingZeros(value);
  const computed: Tuple = [seconds, date];
  dateCache[value] = computed;
  return computed;
};

const getTextFiles = async (folderPath: string): Promise<string[]> => {
  const files = await readdir(folderPath);
  return files.filter((filename) => filename.slice(-3) === 'txt');
};

const TIME_COLUMN_NAMES = [
  'start_time',
  'end_time',
  'arrival_time',
  'departure_time',
  'prior_notice_last_time',
  'prior_notice_start_time',
  'start_pickup_drop_off_window',
];

const TIME_COLUMN_PAIRS = TIME_COLUMN_NAMES.map((name) => [
  name,
  name.endsWith('time') ? `${name}stamp` : `${name}_timestamp`,
]);

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
  task.log(`Importing GTFS from ${task.path}\r`);
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
    } catch (error: any) {
      task.logError(error);
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

    const columns = model.schema.map((column) => {
      let check = '';
      if (column.min !== undefined && column.max) {
        check = `CHECK( ${column.name} >= ${column.min} AND ${column.name} <= ${column.max} )`;
      } else if (column.min) {
        check = `CHECK( ${column.name} >= ${column.min} )`;
      } else if (column.max) {
        check = `CHECK( ${column.name} <= ${column.max} )`;
      }

      const required = column.required ? 'NOT NULL' : '';
      const columnDefault = column.default ? 'DEFAULT ' + column.default : '';
      const columnCollation = column.nocase ? 'COLLATE NOCASE' : '';
      return `${column.name} ${column.type} ${check} ${required} ${columnDefault} ${columnCollation}`;
    });

    // Find Primary Key fields
    const primaryColumns = model.schema.filter((column) => column.primary);

    if (primaryColumns.length > 0) {
      columns.push(
        `PRIMARY KEY (${primaryColumns
          .map((column) => column.name)
          .join(', ')})`,
      );
    }

    db.prepare(`DROP TABLE IF EXISTS ${model.filenameBase};`).run();

    db.prepare(
      `CREATE TABLE ${model.filenameBase} (${columns.join(', ')});`,
    ).run();
  }
};

const createGtfsIndexes = (db: Database.Database): void => {
  for (const model of Object.values(models) as Model[]) {
    if (!model.schema) {
      return;
    }
    for (const column of model.schema.filter((column) => column.index)) {
      db.prepare(
        `CREATE INDEX idx_${model.filenameBase}_${column.name} ON ${model.filenameBase} (${column.name});`,
      ).run();
    }
  }
};

const formatGtfsLine = (
  line: { [x: string]: any; geojson?: string },
  model: Model,
  totalLineCount: number,
): Record<string, any> => {
  const lineNumber = totalLineCount + 1;
  const formattedLine: Record<string, any> = {};

  // Pre-compute these values
  const filenameBase = model.filenameBase;
  const filenameExtension = model.filenameExtension;

  for (const columnSchema of model.schema) {
    const { name, type, required, min, max } = columnSchema;
    let value = line[name];

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

    // Type conversion
    switch (type) {
      case 'date':
        value = value.replace(/-/g, '');
        if (value.length !== 8) {
          throw new Error(
            `Invalid date in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}.`,
          );
        }
        value = parseInt(value, 10);
        break;
      case 'integer':
        value = parseInt(value, 10);
        break;
      case 'real':
        value = parseFloat(value);
        break;
    }

    // Check for NaN after conversion
    if (Number.isNaN(value)) {
      formattedLine[name] = null;
      continue;
    }

    formattedLine[name] = value;

    // Validate min/max
    if (min !== undefined && value < min) {
      throw new Error(
        `Invalid value in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}: below minimum value of ${min}.`,
      );
    }
    if (max !== undefined && value > max) {
      throw new Error(
        `Invalid value in ${filenameBase}.${filenameExtension} for ${name} on line ${lineNumber}: above maximum value of ${max}.`,
      );
    }
  }

  // Process time columns
  for (const [timeColumnName, timestampColumnName] of TIME_COLUMN_PAIRS) {
    const value = formattedLine[timeColumnName];
    if (value) {
      const [seconds, date] = calculateAndCacheDate(value);
      formattedLine[timestampColumnName] = seconds;
      formattedLine[timeColumnName] = date;
    }
  }

  return formattedLine;
};

const importGtfsFiles = (
  db: Database.Database,
  task: GtfsImportTask,
): Promise<void[]> =>
  mapSeries(
    Object.values(models),
    (model: Model) =>
      new Promise<void>((resolve, reject) => {
        let totalLineCount = 0;
        const filename = `${model.filenameBase}.${model.filenameExtension}`;

        // Filter out excluded files from config
        if (task.exclude && task.exclude.includes(model.filenameBase)) {
          task.log(`Skipping - ${filename}\r`);
          resolve();
          return;
        }

        // If the model is a database/gtfs-realtime model then skip silently
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

        const columns = model.schema.filter((column) => column.name !== 'id');
        const placeholder = columns.map(({ name }) => `@${name}`).join(', ');
        const prepareStatement = `INSERT ${task.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${
          model.filenameBase
        } (${columns
          .map((column) => column.name)
          .join(', ')}) VALUES (${placeholder})`;

        const insert = db.prepare(prepareStatement);

        const insertLines = db.transaction((lines) => {
          for (const [rowNumber, line] of Object.entries(lines)) {
            try {
              if (task.prefix === undefined) {
                insert.run(line);
              } else {
                const prefixedLine = Object.fromEntries(
                  Object.entries(
                    line as { [x: string]: any; geojson?: string },
                  ).map(([columnName, value]) => [
                    columnName,
                    columns.find((col) => col.name === columnName)?.prefix
                      ? `${task.prefix}${value}`
                      : value,
                  ]),
                );
                insert.run(prefixedLine);
              }
            } catch (error: any) {
              if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                const primaryColumns = model.schema.filter(
                  (column) => column.primary,
                );
                task.logWarning(
                  `Duplicate values for primary key (${primaryColumns.map((column) => column.name).join(', ')}) found in ${filename}. Set the \`ignoreDuplicates\` option to true in config.json to ignore this error`,
                );
              }

              task.logWarning(
                `Check ${filename} for invalid data on row ${rowNumber}.`,
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

          let lines: { [x: string]: any; geojson?: string }[] = [];

          parser.on('readable', () => {
            let record;

            while ((record = parser.read())) {
              totalLineCount += 1;
              lines.push(formatGtfsLine(record, model, totalLineCount));
            }
          });

          parser.on('end', () => {
            try {
              insertLines(lines);
              task.log(
                `Importing - ${filename} - ${totalLineCount} lines imported\r`,
                true,
              );
            } catch (error) {
              reject(error);
            }
            resolve();
          });

          parser.on('error', reject);

          createReadStream(filepath).pipe(stripBomStream()).pipe(parser);
        } else if (model.filenameExtension === 'geojson') {
          readFile(filepath, 'utf8')
            .then((data) => {
              if (isValidJSON(data) === false) {
                reject(new Error(`Invalid JSON in ${filename}`));
              }
              totalLineCount += 1;
              const line = formatGtfsLine(
                { geojson: data },
                model,
                totalLineCount,
              );
              insertLines([line]);
              task.log(
                `Importing - ${filename} - ${totalLineCount} lines imported\r`,
                true,
              );
              resolve();
            })
            .catch(reject);
        } else {
          reject(
            new Error(`Unsupported file type: ${model.filenameExtension}`),
          );
        }
      }),
  );

export async function importGtfs(initialConfig: Config): Promise<void> {
  const timer = new Timer();
  timer.start();

  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);

  try {
    const db = openDb(config);
    const agencyCount = config.agencies.length;

    log(
      `Starting GTFS import for ${pluralize('file', agencyCount, true)} using SQLite database at ${config.sqlitePath}`,
    );

    createGtfsTables(db);

    await mapSeries(config.agencies, async (agency: ConfigAgency) => {
      try {
        const tempPath = temporaryDirectory();

        const task = {
          exclude: agency.exclude,
          url: agency.url,
          headers: agency.headers,
          realtimeAlerts: agency.realtimeAlerts,
          realtimeTripUpdates: agency.realtimeTripUpdates,
          realtimeVehiclePositions: agency.realtimeVehiclePositions,
          downloadDir: tempPath,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          path: agency.path,
          csvOptions: config.csvOptions || {},
          ignoreDuplicates: config.ignoreDuplicates,
          ignoreErrors: config.ignoreErrors,
          sqlitePath: config.sqlitePath,
          prefix: agency.prefix,
          currentTimestamp: Math.floor(Date.now() / 1000),
          log,
          logWarning,
          logError,
        };

        if (task.url) {
          await downloadGtfsFiles(task);
        }

        await extractGtfsFiles(task);
        await importGtfsFiles(db, task);
        await updateGtfsRealtimeData(task);

        await rm(tempPath, { recursive: true });
      } catch (error: any) {
        handleImportError(error, config, logError);
      }
    });

    log(`Creating DB indexes`);
    createGtfsIndexes(db);

    const seconds = Math.round(timer.time() / 1000);
    timer.stop();

    log(
      `Completed GTFS import for ${pluralize('agency', agencyCount, true)} in ${seconds} seconds\n`,
    );
  } catch (error: any) {
    handleDatabaseError(error, config, logError);
  }
}

function handleImportError(
  error: any,
  config: Config,
  logError: (message: string) => void,
): void {
  if (config.ignoreErrors) {
    logError(error.message);
  } else {
    throw error;
  }
}

function handleDatabaseError(
  error: any,
  config: Config,
  logError: (message: string) => void,
): void {
  if (error?.code === 'SQLITE_CANTOPEN') {
    logError(
      `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
    );
  }
  throw error;
}
