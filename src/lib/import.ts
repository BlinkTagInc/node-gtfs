import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { cp, readdir, rename, readFile, rm, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse';
import pluralize from 'pluralize';
import stripBomStream from 'strip-bom-stream';
import { temporaryDirectory } from 'tempy';
import untildify from 'untildify';
import mapSeries from 'promise-map-series';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import sqlString from 'sqlstring-sqlite';
import Database from 'better-sqlite3';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { unzip } from './file-utils.ts';
import { isValidJSON } from './geojson-utils.ts';
import {
  log as _log,
  logError as _logError,
  logWarning as _logWarning,
} from './log-utils.ts';
import {
  calculateSecondsFromMidnight,
  setDefaultConfig,
  validateConfigForImport,
  convertLongTimeToDate,
  padLeadingZeros,
} from './utils.ts';

import { IConfig, IModel, IColumn } from '../types/global_interfaces.ts';

interface ITask {
  exclude: string[];
  agency_url: string;
  headers: Record<string, string>;
  realtime_headers?: Record<string, string>;
  realtime_urls?: string[];
  downloadDir: string;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  path: string;
  csvOptions: {};
  ignoreDuplicates: boolean;
  sqlitePath: string;
  prefix?: string;
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

interface IRealtimeTask {
  realtime_urls: string[];
  realtime_headers?: Record<string, string>;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  sqlitePath: string;
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

const downloadFiles = async (task: ITask) => {
  task.log(`Downloading GTFS from ${task.agency_url}`);

  task.path = `${task.downloadDir}/gtfs.zip`;

  const response = await fetch(task.agency_url, {
    method: 'GET',
    headers: task.headers || {},
    signal: task.downloadTimeout
      ? AbortSignal.timeout(task.downloadTimeout)
      : undefined,
  });

  if (response.status !== 200) {
    throw new Error(`Unable to download GTFS from ${task.agency_url}`);
  }

  const buffer = await response.arrayBuffer();

  await writeFile(task.path, Buffer.from(buffer));
  task.log('Download successful');
};

const downloadGtfsRealtimeData = async (url: string, task: IRealtimeTask) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...(task.realtime_headers || {}),
      'Accept-Encoding': 'gzip',
    },
    signal: task.downloadTimeout
      ? AbortSignal.timeout(task.downloadTimeout)
      : undefined,
  });

  if (response.status !== 200) {
    task.logWarning(`Unable to download GTFS-Realtime from ${url}`);
    return null;
  }

  const buffer = await response.arrayBuffer();
  const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(message, {
    enums: String,
    longs: String,
    bytes: String,
    defaults: true,
    arrays: true,
    objects: true,
    oneofs: true,
  });
};

function getDescendantProp(obj: any, defaultValue: any, source?: string) {
  if (source === undefined) return defaultValue;
  const arr = source.split('.');
  while (arr.length) {
    const nextKey = arr.shift();
    if (nextKey === undefined) {
      return defaultValue;
    } else if (obj == null) {
      return defaultValue;
    } else if (nextKey?.includes('[')) {
      const arrayKey = nextKey.match(/(\w*)\[(\d+)\]/);
      if (arrayKey === null) {
        return defaultValue;
      }
      if (obj[arrayKey[1]] === undefined) {
        return defaultValue;
      }

      if (obj[arrayKey[1]][arrayKey[2]] === undefined) {
        return defaultValue;
      }

      obj = obj[arrayKey[1]][arrayKey[2]];
    } else {
      if (obj[nextKey] === undefined) {
        return defaultValue;
      }
      obj = obj[nextKey];
    }
  }

  if (obj.__isLong__) return convertLongTimeToDate(obj);

  return obj;
}

const deleteExpiredRealtimeData = (config: IConfig) => {
  const log = _log(config);
  const db = openDb(config);

  log(`Removing expired GTFS-Realtime data`);
  db.prepare(
    `DELETE FROM vehicle_positions WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM trip_updates WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM stop_time_updates WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM service_alerts WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM service_alert_targets WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  log(`Removed expired GTFS-Realtime data\r`, true);
};

const prepareRealtimeValue = (
  entity: any,
  column: IColumn,
  task: IRealtimeTask,
) => {
  if (column.name === 'created_timestamp') {
    return task.currentTimestamp;
  }

  if (column.name === 'expiration_timestamp') {
    return task.currentTimestamp + task.gtfsRealtimeExpirationSeconds;
  }

  return sqlString.escape(
    getDescendantProp(entity, column.default, column.source),
  );
};

const updateRealtimeData = async (task: IRealtimeTask) => {
  if (!task.realtime_urls) {
    return;
  }

  const db = openDb({
    sqlitePath: task.sqlitePath,
  });

  task.log(
    `Starting GTFS-Realtime import from ${task.realtime_urls.length} urls`,
  );

  for (const realtimeUrl of task.realtime_urls) {
    task.log(`Downloading GTFS-Realtime from ${realtimeUrl}`);
    // eslint-disable-next-line no-await-in-loop
    const gtfsRealtimeData = await downloadGtfsRealtimeData(realtimeUrl, task);

    if (!gtfsRealtimeData?.entity) {
      continue;
    }

    task.log(`Download successful`);

    let totalLineCount = 0;

    for (const entity of gtfsRealtimeData.entity) {
      // Determine the type of GTFS-Realtime
      let model;
      if (entity.vehicle) {
        model = models.vehiclePositions;
      }

      if (entity.tripUpdate) {
        model = models.tripUpdates;
      }

      if (entity.alert) {
        model = models.serviceAlerts;
      }

      if (!model) {
        break;
      }

      // Do base processing
      const fieldValues = model.schema.map((column: IColumn) =>
        prepareRealtimeValue(entity, column, task),
      );

      try {
        db.prepare(
          `REPLACE INTO ${model.filenameBase} (${model.schema
            .map((column) => column.name)
            .join(', ')}) VALUES (${fieldValues.join(', ')})`,
        ).run();
      } catch (error: any) {
        task.logWarning('Import error: ' + error.message);
      }

      // Special processing for tripUpdates
      if (entity.tripUpdate) {
        const stopTimeUpdateArray = [];
        for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate) {
          stopTimeUpdate.parent = entity;
          const subValues = models.stopTimeUpdates.schema.map((column) =>
            prepareRealtimeValue(stopTimeUpdate, column, task),
          );
          stopTimeUpdateArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        try {
          db.prepare(
            `REPLACE INTO ${models.stopTimeUpdates.filenameBase} (${models.stopTimeUpdates.schema
              .map((column) => column.name)
              .join(', ')}) VALUES ${stopTimeUpdateArray.join(', ')}`,
          ).run();
        } catch (error: any) {
          task.logWarning('Import error: ' + error.message);
        }
      }

      // Special processing for serviceAlerts
      if (entity.alert) {
        const alertTargetArray = [];
        for (const informedEntity of entity.alert.informedEntity) {
          informedEntity.parent = entity;
          const subValues = models.serviceAlertTargets.schema.map((column) =>
            prepareRealtimeValue(informedEntity, column, task),
          );
          alertTargetArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        try {
          db.prepare(
            `REPLACE INTO ${models.serviceAlertTargets.filenameBase} (${models.serviceAlertTargets.schema
              .map((column) => column.name)
              .join(', ')}) VALUES ${alertTargetArray.join(', ')}`,
          ).run();
        } catch (error: any) {
          task.logWarning('Import error: ' + error.message);
        }
      }

      task.log(`Importing - ${totalLineCount++} entries imported\r`, true);
    }
  }

  task.log(`GTFS-Realtime data import complete`);
};

const getTextFiles = async (folderPath: string) => {
  const files = await readdir(folderPath);
  return files.filter((filename) => filename.slice(-3) === 'txt');
};

const readFiles = async (task: ITask) => {
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

const createTables = (db: Database.Database) => {
  for (const model of Object.values(models) as IModel[]) {
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

    for (const column of model.schema.filter((column) => column.index)) {
      db.prepare(
        `CREATE INDEX idx_${model.filenameBase}_${column.name} ON ${model.filenameBase} (${column.name});`,
      ).run();
    }
  }
};

const formatLine = (
  line: { [x: string]: any; geojson?: string },
  model: IModel,
  totalLineCount: number,
) => {
  const lineNumber = totalLineCount + 1;

  const formattedLine: Record<string, any> = {};

  for (const columnSchema of model.schema) {
    const lineValue = line[columnSchema.name];

    if (columnSchema.type === 'date') {
      if (lineValue !== '' && lineValue !== undefined) {
        // Convert fields that are dates into integers
        // Allow YYYYMMDD and YYYY-MM-DD formats
        const dateValue = lineValue.replace(/-/g, '');

        if (dateValue.length !== 8) {
          throw new Error(
            `Invalid date in ${model.filenameBase}.${model.filenameExtension} for ${columnSchema.name} on line ${lineNumber}.`,
          );
        }

        formattedLine[columnSchema.name] = Number.parseInt(dateValue, 10);
      }
    } else if (columnSchema.type === 'integer') {
      // Convert fields that should be integer
      formattedLine[columnSchema.name] = Number.parseInt(lineValue, 10);
    } else if (columnSchema.type === 'real') {
      // Convert fields that should be float
      formattedLine[columnSchema.name] = Number.parseFloat(lineValue);
    } else {
      formattedLine[columnSchema.name] = lineValue;
    }

    if (
      formattedLine[columnSchema.name] === '' ||
      formattedLine[columnSchema.name] === undefined ||
      formattedLine[columnSchema.name] === null ||
      Number.isNaN(formattedLine[columnSchema.name])
    ) {
      // Add null values
      formattedLine[columnSchema.name] = null;
    }

    // Validate required
    if (
      columnSchema.required === true &&
      formattedLine[columnSchema.name] === null
    ) {
      throw new Error(
        `Missing required value in ${model.filenameBase}.${model.filenameExtension} for ${columnSchema.name} on line ${lineNumber}.`,
      );
    }

    // Validate minimum
    if (
      columnSchema.min !== undefined &&
      formattedLine[columnSchema.name] < columnSchema.min
    ) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.${model.filenameExtension} for ${columnSchema.name} on line ${lineNumber}: below minimum value of ${columnSchema.min}.`,
      );
    }

    // Validate maximum
    if (
      columnSchema.max !== undefined &&
      formattedLine[columnSchema.name] > columnSchema.max
    ) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.${model.filenameExtension} for ${columnSchema.name} on line ${lineNumber}: above maximum value of ${columnSchema.max}.`,
      );
    }
  }

  // Convert to midnight timestamp and add timestamp columns as integer seconds from midnight
  const timeColumnNames = [
    'start_time',
    'end_time',
    'arrival_time',
    'departure_time',
    'prior_notice_last_time',
    'prior_notice_start_time',
    'start_pickup_drop_off_window',
  ];

  for (const timeColumnName of timeColumnNames) {
    if (formattedLine[timeColumnName]) {
      const timestampColumnName = timeColumnName.endsWith('time')
        ? `${timeColumnName}stamp`
        : `${timeColumnName}_timestamp`;
      formattedLine[timestampColumnName] = calculateSecondsFromMidnight(
        formattedLine[timeColumnName],
      );

      // Ensure leading zeros for time columns
      formattedLine[timeColumnName] = padLeadingZeros(
        formattedLine[timeColumnName],
      );
    }
  }

  return formattedLine;
};

const importLines = (
  task: ITask,
  lines: { [x: string]: any; geojson?: string }[],
  model: IModel,
  totalLineCount: number,
) => {
  const db = openDb({
    sqlitePath: task.sqlitePath,
  });

  if (lines.length === 0) {
    return;
  }

  const linesToImportCount = lines.length;
  const columns = model.schema.filter((column) => column.name !== 'id');
  const placeholders = [];
  const values = [];

  while (lines.length > 0) {
    const line = lines.pop();

    if (line === undefined) {
      continue;
    }

    placeholders.push(`(${columns.map(() => '?').join(', ')})`);
    values.push(
      ...columns.map((column) => {
        if (task.prefix !== undefined && column.prefix === true) {
          // Add prefixes to field values if needed
          return `${task.prefix}${line[column.name]}`;
        }

        return line[column.name];
      }),
    );
  }

  try {
    db.prepare(
      `INSERT ${task.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${
        model.filenameBase
      } (${columns
        .map((column) => column.name)
        .join(', ')}) VALUES ${placeholders.join(',')}`,
    ).run(...values);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      const primaryColumns = model.schema.filter((column) => column.primary);
      task.logWarning(
        `Duplicate values for primary key (${primaryColumns.map((column) => column.name).join(', ')}) found in ${model.filenameBase}.${model.filenameExtension}. Set the \`ignoreDuplicates\` option to true in config.json to ignore this error`,
      );
    }

    task.logWarning(
      `Check ${model.filenameBase}.${model.filenameExtension} for invalid data between lines ${
        totalLineCount - linesToImportCount
      } and ${totalLineCount}.`,
    );
    throw error;
  }

  task.log(
    `Importing - ${model.filenameBase}.${model.filenameExtension} - ${totalLineCount} lines imported\r`,
    true,
  );
};

const importFiles = (task: ITask) =>
  mapSeries(
    Object.values(models),
    (model: IModel) =>
      new Promise<void>((resolve, reject) => {
        const lines: {}[] = [];
        let totalLineCount = 0;
        const maxInsertVariables = 32_000;

        // Loop through each GTFS file
        // Filter out excluded files from config
        if (task.exclude && task.exclude.includes(model.filenameBase)) {
          task.log(
            `Skipping - ${model.filenameBase}.${model.filenameExtension}\r`,
          );
          resolve();
          return;
        }

        // If the model is a database/gtfs-realtime model then silently exit
        if (model.extension === 'gtfs-realtime') {
          resolve();
          return;
        }

        const filepath = path.join(
          task.downloadDir,
          `${model.filenameBase}.${model.filenameExtension}`,
        );

        if (!existsSync(filepath)) {
          // Log only missing standard GTFS files
          if (!model.nonstandard) {
            task.log(
              `Importing - ${model.filenameBase}.${model.filenameExtension} - No file found\r`,
            );
          }

          resolve();
          return;
        }

        task.log(
          `Importing - ${model.filenameBase}.${model.filenameExtension}\r`,
        );

        if (model.filenameExtension === 'txt') {
          const parser = parse({
            columns: true,
            relax_quotes: true,
            trim: true,
            skip_empty_lines: true,
            ...task.csvOptions,
          });

          parser.on('readable', () => {
            let record;

            while ((record = parser.read())) {
              try {
                totalLineCount += 1;
                lines.push(formatLine(record, model, totalLineCount));
                // If we have a bunch of lines ready to insert, then do it
                if (lines.length >= maxInsertVariables / model.schema.length) {
                  importLines(task, lines, model, totalLineCount);
                }
              } catch (error) {
                reject(error);
              }
            }
          });

          parser.on('end', () => {
            try {
              // Insert all remaining lines
              importLines(task, lines, model, totalLineCount);
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
                reject(
                  new Error(
                    `Invalid JSON in ${model.filenameBase}.${model.filenameExtension}`,
                  ),
                );
              }
              const line = formatLine({ geojson: data }, model, totalLineCount);
              importLines(task, [line], model, totalLineCount);
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

export async function importGtfs(initialConfig: IConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);
  try {
    const db = openDb(config);

    const agencyCount = config.agencies.length;
    log(
      `Starting GTFS import for ${pluralize(
        'file',
        agencyCount,
        true,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    createTables(db);

    await mapSeries(
      config.agencies,
      async (agency: {
        exclude: any;
        url: any;
        headers: any;
        realtimeHeaders: any;
        realtimeUrls: any;
        path: any;
        prefix: any;
        realtime_headers: Record<string, string>;
      }) => {
        const tempPath = temporaryDirectory();

        const task = {
          exclude: agency.exclude,
          agency_url: agency.url,
          headers: agency.headers,
          realtime_headers: agency.realtimeHeaders,
          realtime_urls: agency.realtimeUrls,
          downloadDir: tempPath,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          path: agency.path,
          csvOptions: config.csvOptions || {},
          ignoreDuplicates: config.ignoreDuplicates,
          sqlitePath: config.sqlitePath,
          prefix: agency.prefix,
          currentTimestamp: Math.floor(Date.now() / 1000),
          log,
          logWarning,
          logError,
        };

        try {
          if (task.agency_url) {
            await downloadFiles(task);
          }

          await readFiles(task);
          await importFiles(task);
          await updateRealtimeData(task);

          await rm(tempPath, { recursive: true });
        } catch (error: any) {
          if (config.ignoreErrors) {
            logError(error.message);
          } else {
            throw error;
          }
        }
      },
    );

    log(
      `Completed GTFS import for ${pluralize('agency', agencyCount, true)}\n`,
    );
  } catch (error: any) {
    if (error?.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }

    throw error;
  }
}

export async function updateGtfsRealtime(initialConfig: IConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);

  try {
    openDb(config);

    const agencyCount = config.agencies.length;
    log(
      `Starting GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    deleteExpiredRealtimeData(config);

    await Promise.all(
      config.agencies.map(async (agency) => {
        if (agency.realtimeUrls === undefined) {
          return;
        }

        const task = {
          realtime_headers: agency.realtimeHeaders,
          realtime_urls: agency.realtimeUrls,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          sqlitePath: config.sqlitePath,
          currentTimestamp: Math.floor(Date.now() / 1000),
          log,
          logWarning,
          logError,
        };

        await updateRealtimeData(task);
      }),
    );

    log(
      `Completed GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )}\n`,
    );
  } catch (error: any) {
    if (error?.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unae to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }

    throw error;
  }
}
